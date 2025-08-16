# Query Optimization Recommendations

## Overview
This document outlines query optimization strategies for the enhanced voice agent database schema, focusing on real-time performance requirements and multi-tenant efficiency.

## Index Strategy

### Primary Indexes (Already Implemented)
```sql
-- Organization-scoped queries
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");
CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");

-- Location management
CREATE INDEX "Location_organizationId_isActive_idx" ON "Location"("organizationId", "isActive");
CREATE INDEX "Location_organizationId_sortOrder_idx" ON "Location"("organizationId", "sortOrder");

-- Agent configuration
CREATE INDEX "AgentConfig_organizationId_isActive_idx" ON "AgentConfig"("organizationId", "isActive");
CREATE INDEX "AgentConfig_organizationId_version_idx" ON "AgentConfig"("organizationId", "version");

-- Call performance
CREATE INDEX "Call_organizationId_createdAt_idx" ON "Call"("organizationId", "createdAt");
CREATE INDEX "Call_twilioCallSid_idx" ON "Call"("twilioCallSid");
CREATE INDEX "Call_callerPhone_createdAt_idx" ON "Call"("callerPhone", "createdAt");

-- Real-time turn access
CREATE INDEX "Turn_callId_turnIndex_idx" ON "Turn"("callId", "turnIndex");

-- Event telemetry
CREATE INDEX "CallEvent_callId_eventType_idx" ON "CallEvent"("callId", "eventType");
CREATE INDEX "CallEvent_callId_timestamp_idx" ON "CallEvent"("callId", "timestamp");

-- Appointment scheduling
CREATE INDEX "Appointment_organizationId_startAt_idx" ON "Appointment"("organizationId", "startAt");
CREATE INDEX "Appointment_locationId_startAt_idx" ON "Appointment"("locationId", "startAt");
CREATE INDEX "Appointment_contactPhone_idx" ON "Appointment"("contactPhone");

-- Knowledge base search
CREATE INDEX "KnowledgeBase_organizationId_category_isActive_idx" ON "KnowledgeBase"("organizationId", "category", "isActive");
CREATE INDEX "KnowledgeBase_organizationId_tags_idx" ON "KnowledgeBase" USING GIN ("organizationId", "tags");
```

### Additional Recommended Indexes

```sql
-- For frequent call status updates during active calls
CREATE INDEX "Call_status_lastTransition_idx" ON "Call"("status", "lastTransition") 
WHERE "status" IN ('in_progress', 'connecting');

-- For appointment availability queries
CREATE INDEX "Appointment_startAt_endAt_status_idx" ON "Appointment"("startAt", "endAt", "status")
WHERE "status" NOT IN ('cancelled', 'completed');

-- For knowledge base full-text search (if needed)
CREATE INDEX "KnowledgeBase_content_fulltext_idx" ON "KnowledgeBase" USING GIN (to_tsvector('english', content))
WHERE "isActive" = true;

-- For call analytics queries
CREATE INDEX "Call_organizationId_status_createdAt_idx" ON "Call"("organizationId", "status", "createdAt");

-- For turn performance analysis
CREATE INDEX "Turn_callId_asrMs_llmMs_ttsMs_idx" ON "Turn"("callId", "asrMs", "llmMs", "ttsMs")
WHERE "asrMs" IS NOT NULL OR "llmMs" IS NOT NULL OR "ttsMs" IS NOT NULL;
```

## Query Patterns & Optimization

### 1. Real-Time Voice Pipeline Queries

**Active Agent Config Lookup**
```javascript
// Optimized query for getting active agent configuration
const activeConfig = await prisma.agentConfig.findFirst({
  where: {
    organizationId,
    isActive: true
  },
  orderBy: { version: 'desc' }
});
```

**Knowledge Base Fast Lookup**
```javascript
// Efficient knowledge base search
const facts = await prisma.knowledgeBase.findMany({
  where: {
    organizationId,
    category,
    isActive: true,
    tags: { hasSome: searchTags }
  },
  orderBy: { priority: 'desc' },
  take: 5
});
```

### 2. Appointment Scheduling Queries

**Available Slots Query**
```javascript
// Optimized availability checking
const conflicts = await prisma.appointment.findMany({
  where: {
    organizationId,
    locationId,
    startAt: { lte: proposedEnd },
    endAt: { gte: proposedStart },
    status: { notIn: ['cancelled', 'completed'] }
  },
  select: { startAt: true, endAt: true }
});
```

**Location-Aware Scheduling**
```javascript
// Get locations with services and availability
const availableLocations = await prisma.location.findMany({
  where: {
    organizationId,
    isActive: true,
    services: { path: ['some', 'id'], equals: serviceId }
  },
  orderBy: { sortOrder: 'asc' },
  include: {
    appointments: {
      where: {
        startAt: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['cancelled'] }
      }
    }
  }
});
```

### 3. Analytics & Reporting Queries

**Call Performance Metrics**
```javascript
// Efficient call analytics with proper indexing
const metrics = await prisma.call.groupBy({
  by: ['status', 'agentConfigId'],
  where: {
    organizationId,
    createdAt: { gte: startDate, lte: endDate }
  },
  _avg: { durationSeconds: true, totalTurns: true },
  _count: { id: true }
});
```

**Turn-Level Performance Analysis**
```javascript
// Average response times by call
const turnMetrics = await prisma.turn.groupBy({
  by: ['callId'],
  where: {
    call: { organizationId },
    createdAt: { gte: startDate, lte: endDate }
  },
  _avg: { asrMs: true, llmMs: true, ttsMs: true },
  _count: { id: true }
});
```

## Database Connection Optimization

### Connection Pooling
```javascript
// Recommended Prisma Client configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool optimization for real-time workloads
  __internal: {
    engine: {
      connection_limit: 20,      // Adjust based on concurrent calls
      pool_timeout: 10,          // 10 seconds
      connect_timeout: 60,       // 60 seconds
      schema_cache_size: 1000,   // Schema cache
    },
  },
});
```

### Query Timeout Configuration
```javascript
// Set appropriate timeouts for different query types
const QUERY_TIMEOUTS = {
  realtime: 500,    // 500ms for voice pipeline queries
  analytics: 30000,  // 30s for reporting queries
  batch: 60000      // 60s for batch operations
};

// Usage
const result = await prisma.$queryRaw`...`.timeout(QUERY_TIMEOUTS.realtime);
```

## Partitioning Strategy

### Time-Based Partitioning for Call Data
```sql
-- Partition Call table by month for better performance and archival
CREATE TABLE "Call_2024_01" PARTITION OF "Call" 
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE "Call_2024_02" PARTITION OF "Call" 
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Create partition management function
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    -- Create partitions for next 3 months
    FOR i IN 0..2 LOOP
        start_date := date_trunc('month', CURRENT_DATE + interval '%s months', i);
        end_date := start_date + interval '1 month';
        partition_name := 'Call_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF "Call" 
                       FOR VALUES FROM (%L) TO (%L)',
                       partition_name, start_date, end_date);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## Monitoring & Performance

### Key Metrics to Monitor
```sql
-- Slow query identification
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%Call%' OR query ILIKE '%Turn%' OR query ILIKE '%Appointment%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage analysis
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public' AND tablename IN ('Call', 'Turn', 'Appointment', 'AgentConfig')
ORDER BY tablename, attname;

-- Connection monitoring
SELECT state, count(*) 
FROM pg_stat_activity 
WHERE datname = current_database() 
GROUP BY state;
```

### Query Plan Analysis
```javascript
// Use EXPLAIN ANALYZE for query optimization
const explainQuery = async (query) => {
  const result = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}
  `;
  console.log(JSON.stringify(result[0], null, 2));
};
```

## Caching Strategy

### Application-Level Caching
```javascript
// Redis caching for frequent queries
const cacheKeys = {
  agentConfig: (orgId) => `agent_config:${orgId}`,
  knowledgeBase: (orgId, category) => `kb:${orgId}:${category}`,
  businessHours: (orgId) => `hours:${orgId}`
};

// Cache active agent config (rarely changes)
const getActiveAgentConfig = async (organizationId) => {
  const cacheKey = cacheKeys.agentConfig(organizationId);
  let config = await redis.get(cacheKey);
  
  if (!config) {
    config = await prisma.agentConfig.findFirst({
      where: { organizationId, isActive: true }
    });
    await redis.setex(cacheKey, 3600, JSON.stringify(config)); // 1 hour TTL
  } else {
    config = JSON.parse(config);
  }
  
  return config;
};
```

## Best Practices Summary

1. **Always filter by organizationId first** - Ensures tenant isolation and uses primary indexes
2. **Use composite indexes** - Match your common WHERE clause patterns
3. **Limit result sets** - Use `take` and `skip` for pagination
4. **Project only needed fields** - Use `select` to reduce data transfer
5. **Batch related queries** - Use `include` instead of N+1 queries
6. **Monitor query performance** - Use `pg_stat_statements` and EXPLAIN ANALYZE
7. **Cache frequently accessed data** - Agent configs, knowledge base, business rules
8. **Use prepared statements** - Prisma does this automatically, but be aware
9. **Consider read replicas** - For analytics and reporting queries
10. **Implement query timeouts** - Prevent hung connections in real-time scenarios

## Performance Targets

- **Real-time voice queries**: < 100ms (knowledge base lookup, config retrieval)
- **Appointment availability**: < 500ms (complex scheduling queries)
- **Call telemetry writes**: < 50ms (turn and event logging)
- **Analytics queries**: < 5s (reporting and dashboard data)
- **Batch operations**: < 60s (migrations, bulk updates)