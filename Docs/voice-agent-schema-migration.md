# Voice Agent Schema Migration Guide

## Overview

This document outlines the comprehensive database schema updates needed to support enhanced voice agent features in InfiniOffice, including location management, advanced agent configuration, enhanced telemetry, and knowledge base functionality.

## What's New

### 1. Location Management
- **Multi-branch support**: Organizations can now manage multiple locations
- **Location-specific configurations**: Each location can have its own business hours, services, and providers
- **Enhanced appointment model**: Appointments are now linked to specific locations
- **Address normalization**: Structured address storage for consistency

### 2. Agent Configuration System
- **Versioned configurations**: Support for multiple agent configurations with version control
- **Policy management**: Configurable business rules, escalation policies, and behavioral settings
- **Script customization**: Location and tenant-specific script overrides
- **Rollback capability**: Easy rollback to previous configurations

### 3. Enhanced Telemetry & Analytics
- **Detailed turn metrics**: ASR confidence, token counts, sentiment analysis
- **Event tracking**: Comprehensive logging of digressions, confirmations, and barge-ins
- **Performance monitoring**: Response times, interruption detection, and quality metrics
- **Business intelligence**: Data structured for advanced analytics and optimization

### 4. Knowledge Base System
- **Fact storage**: Structured storage for business information, policies, and FAQs
- **Category organization**: Organized by business_info, hours, policies, services, faq
- **Search optimization**: Tagged and prioritized for efficient retrieval
- **Real-time updates**: Support for dynamic knowledge updates during calls

## Migration Steps

### Step 1: Apply Database Schema Changes

```bash
# Backup your current database
pg_dump $DATABASE_URL > backup_pre_voice_agent_migration.sql

# Apply the migration
npx prisma db push --schema prisma/schema_updated.prisma

# Or run the migration SQL directly
psql $DATABASE_URL -f prisma/migrations/20250815000001_add_voice_agent_features/migration.sql
```

### Step 2: Update Prisma Schema

```bash
# Replace the current schema with the updated version
cp prisma/schema_updated.prisma prisma/schema.prisma

# Regenerate Prisma client
npx prisma generate
```

### Step 3: Seed New Features

```bash
# Seed voice agent features with sample data
node scripts/seed-voice-agent-features.js

# This will create:
# - Sample locations for multi-branch businesses
# - Agent configurations with different policies
# - Knowledge base entries for common FAQ
# - Enhanced appointment data with location references
```

### Step 4: Update Application Code

The new schema requires updates to your application code to take advantage of the new features:

#### Location-Aware Scheduling
```javascript
// Example: Location-aware appointment booking
const availableSlots = await prisma.appointment.findMany({
  where: {
    organizationId,
    locationId: preferredLocationId,
    startAt: { gte: startDate, lte: endDate },
    status: { notIn: ['cancelled', 'completed'] }
  },
  include: {
    location: {
      select: { name: true, address: true, businessHours: true }
    }
  }
});
```

#### Dynamic Agent Configuration
```javascript
// Example: Load active agent configuration
const agentConfig = await prisma.agentConfig.findFirst({
  where: {
    organizationId,
    isActive: true
  },
  orderBy: { version: 'desc' }
});

// Use configuration in voice pipeline
const greeting = agentConfig?.scriptOverrides?.greeting || 
                 defaultConfig.greeting;
```

#### Enhanced Telemetry Logging
```javascript
// Example: Log call events with enhanced data
await prisma.callEvent.create({
  data: {
    callId,
    eventType: 'digression',
    eventData: {
      originalIntent: 'book_appointment',
      digressionTopic: 'business_hours',
      returnSuccessful: true
    },
    turnIndex: currentTurnIndex
  }
});
```

#### Knowledge Base Integration
```javascript
// Example: Query knowledge base for FAQ
const facts = await prisma.knowledgeBase.findMany({
  where: {
    organizationId,
    category: 'faq',
    isActive: true,
    tags: { hasSome: ['hours', 'parking'] }
  },
  orderBy: { priority: 'desc' },
  take: 3
});
```

## Performance Optimization

### Indexing Strategy
The migration includes comprehensive indexing for optimal query performance:

- **Organization-scoped queries**: All tenant data properly indexed
- **Real-time voice pipeline**: Sub-100ms query times for configuration and knowledge base lookups
- **Analytics queries**: Efficient aggregation for reporting dashboards
- **Time-series data**: Optimized for call and event data retrieval

### Query Optimization
Follow the patterns in `/docs/query-optimization-recommendations.md`:

- Always filter by `organizationId` first
- Use composite indexes for common query patterns
- Implement proper pagination for large datasets
- Cache frequently accessed configurations

## Data Retention & Cleanup

### Automatic Cleanup Policies
The new schema includes automated data retention:

```bash
# Set up automatic cleanup (runs daily at 2 AM)
node scripts/data-retention-cleanup.js --schedule

# Manual cleanup with dry-run
node scripts/data-retention-cleanup.js --dry-run

# Full cleanup
node scripts/data-retention-cleanup.js
```

### Retention Periods
- **Call records**: 2 years (regulatory compliance)
- **Turn data**: 1 year (performance analysis)  
- **Call events**: 6 months (debugging)
- **Appointments**: 5 years (business records)
- **Failed calls**: 3 months (shorter retention)

### Data Sanitization
Automatic PII removal from older records while preserving analytics value:
- Transcripts removed after 3 months
- Phone numbers redacted in old call records
- Structured data preserved for business intelligence

## Testing & Validation

### Validate Migration Success
```bash
# Check table creation
psql $DATABASE_URL -c "\dt"

# Validate indexes
psql $DATABASE_URL -c "\di"

# Check sample data
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.location.count().then(count => console.log('Locations:', count));
prisma.agentConfig.count().then(count => console.log('Agent Configs:', count));
prisma.knowledgeBase.count().then(count => console.log('Knowledge Base:', count));
"
```

### Performance Testing
```bash
# Run performance tests on new schema
npm run test:performance

# Analyze query performance
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.time('Agent Config Lookup');
prisma.agentConfig.findFirst({
  where: { organizationId: 'your-org-id', isActive: true }
}).then(() => console.timeEnd('Agent Config Lookup'));
"
```

## Rollback Plan

### Emergency Rollback
If issues occur during migration:

```bash
# Restore from backup
psql $DATABASE_URL < backup_pre_voice_agent_migration.sql

# Revert Prisma schema
git checkout HEAD~1 -- prisma/schema.prisma
npx prisma generate
```

### Gradual Rollback
For production environments, implement feature flags to gradually enable new features:

```javascript
const FEATURE_FLAGS = {
  LOCATION_MANAGEMENT: process.env.ENABLE_LOCATIONS === 'true',
  AGENT_CONFIGS: process.env.ENABLE_AGENT_CONFIGS === 'true',
  ENHANCED_TELEMETRY: process.env.ENABLE_TELEMETRY === 'true',
  KNOWLEDGE_BASE: process.env.ENABLE_KNOWLEDGE_BASE === 'true'
};
```

## Monitoring & Maintenance

### Key Metrics to Monitor
- Query performance on new tables
- Database size growth (especially Call and Turn tables)
- Index usage and effectiveness
- Connection pool utilization

### Regular Maintenance Tasks
- Weekly database statistics updates
- Monthly retention policy execution
- Quarterly index optimization review
- Annual schema performance audit

## Future Extensibility

The new schema is designed with extension points for future features:

### RAG Integration Ready
- Knowledge base structured for vector search integration
- Metadata fields for embeddings and semantic search
- Category system supports hierarchical organization

### Advanced Analytics
- Turn-level data supports ML model training
- Event tracking enables conversation flow optimization
- Performance metrics support A/B testing of configurations

### Multi-Modal Support
- Flexible metadata fields support voice, chat, and video channels
- Agent configuration system supports channel-specific settings
- Knowledge base supports rich media content types

## Support & Troubleshooting

### Common Issues
1. **Migration timeout**: For large datasets, run migration during low-traffic periods
2. **Index creation slowness**: Create indexes in parallel where possible
3. **Foreign key conflicts**: Ensure data consistency before applying constraints

### Getting Help
- Check the query optimization guide for performance issues
- Review the cleanup script for data retention questions
- Monitor database logs for constraint violations or performance warnings

### Validation Queries
```sql
-- Check referential integrity
SELECT COUNT(*) FROM "Call" WHERE "agentConfigId" IS NOT NULL 
  AND "agentConfigId" NOT IN (SELECT "id" FROM "AgentConfig");

-- Validate location assignments
SELECT COUNT(*) FROM "Appointment" WHERE "locationId" IS NOT NULL 
  AND "locationId" NOT IN (SELECT "id" FROM "Location");

-- Check knowledge base consistency
SELECT category, COUNT(*) FROM "KnowledgeBase" 
GROUP BY category ORDER BY category;
```

This migration represents a significant enhancement to InfiniOffice's voice agent capabilities while maintaining backward compatibility and providing a clear upgrade path for existing deployments.