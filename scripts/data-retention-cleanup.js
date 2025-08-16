/*
  Data Retention and Cleanup Policies
  
  This script implements data retention policies for:
  1. Call records and transcripts
  2. Turn-level telemetry data
  3. Call events and logs
  4. Completed appointments
  5. Inactive agent configurations
  
  Retention policies:
  - Call data: 2 years (regulatory compliance)
  - Turn data: 1 year (performance analysis)
  - Call events: 6 months (debugging and optimization)
  - Appointments: 5 years (business records)
  - Agent configs: Keep all (version history)
*/

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron');

const prisma = new PrismaClient();

// Retention periods in days
const RETENTION_POLICIES = {
  CALL_DATA: 730,           // 2 years
  TURN_DATA: 365,           // 1 year  
  CALL_EVENTS: 180,         // 6 months
  COMPLETED_APPOINTMENTS: 1825, // 5 years
  FAILED_CALLS: 90,         // 3 months (calls that errored)
  TEMP_TRANSCRIPTS: 30      // 1 month for intermediate transcripts
};

/**
 * Calculate cutoff date for retention policy
 */
function getCutoffDate(retentionDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Clean up old call events
 * These accumulate quickly during active use
 */
async function cleanupCallEvents() {
  const cutoffDate = getCutoffDate(RETENTION_POLICIES.CALL_EVENTS);
  
  console.log(`🧹 Cleaning up call events older than ${cutoffDate.toISOString()}`);
  
  const result = await prisma.callEvent.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate
      }
    }
  });
  
  console.log(`   Deleted ${result.count} call events`);
  return result.count;
}

/**
 * Clean up old turn data
 * Keep turn data longer than events for performance analysis
 */
async function cleanupTurns() {
  const cutoffDate = getCutoffDate(RETENTION_POLICIES.TURN_DATA);
  
  console.log(`🧹 Cleaning up turn data older than ${cutoffDate.toISOString()}`);
  
  // First, get the call IDs that will have all turns deleted
  const oldCalls = await prisma.call.findMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    },
    select: { id: true }
  });
  
  const callIds = oldCalls.map(call => call.id);
  
  if (callIds.length === 0) {
    console.log('   No old turns to delete');
    return 0;
  }
  
  // Delete turns in batches to avoid large transaction locks
  const BATCH_SIZE = 1000;
  let totalDeleted = 0;
  
  for (let i = 0; i < callIds.length; i += BATCH_SIZE) {
    const batch = callIds.slice(i, i + BATCH_SIZE);
    
    const result = await prisma.turn.deleteMany({
      where: {
        callId: {
          in: batch
        }
      }
    });
    
    totalDeleted += result.count;
    console.log(`   Processed batch ${Math.floor(i / BATCH_SIZE) + 1}, deleted ${result.count} turns`);
  }
  
  console.log(`   Total deleted: ${totalDeleted} turns`);
  return totalDeleted;
}

/**
 * Clean up old call records
 * This is the main cleanup - calls cascade to turns and events
 */
async function cleanupCalls() {
  const cutoffDate = getCutoffDate(RETENTION_POLICIES.CALL_DATA);
  
  console.log(`🧹 Cleaning up call records older than ${cutoffDate.toISOString()}`);
  
  // First handle failed/errored calls with shorter retention
  const failedCallsCutoff = getCutoffDate(RETENTION_POLICIES.FAILED_CALLS);
  
  const failedCallsResult = await prisma.call.deleteMany({
    where: {
      createdAt: {
        lt: failedCallsCutoff
      },
      OR: [
        { status: 'failed' },
        { status: 'error' },
        { error: { not: null } }
      ]
    }
  });
  
  console.log(`   Deleted ${failedCallsResult.count} failed calls`);
  
  // Then handle regular call retention
  const result = await prisma.call.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      }
    }
  });
  
  console.log(`   Deleted ${result.count} old call records`);
  return result.count + failedCallsResult.count;
}

/**
 * Clean up old completed appointments
 * Keep for business record purposes
 */
async function cleanupCompletedAppointments() {
  const cutoffDate = getCutoffDate(RETENTION_POLICIES.COMPLETED_APPOINTMENTS);
  
  console.log(`🧹 Cleaning up completed appointments older than ${cutoffDate.toISOString()}`);
  
  const result = await prisma.appointment.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate
      },
      status: {
        in: ['completed', 'cancelled', 'no_show']
      }
    }
  });
  
  console.log(`   Deleted ${result.count} old appointments`);
  return result.count;
}

/**
 * Archive old agent configurations
 * Don't delete - just mark as archived for version history
 */
async function archiveOldAgentConfigs() {
  console.log('📦 Archiving old agent configurations...');
  
  // Mark inactive configs older than 6 months as archived
  const cutoffDate = getCutoffDate(180); // 6 months
  
  const result = await prisma.agentConfig.updateMany({
    where: {
      createdAt: {
        lt: cutoffDate
      },
      isActive: false,
      // Don't archive if it's the only config for an organization
      organization: {
        agentConfigs: {
          some: {
            isActive: true
          }
        }
      }
    },
    data: {
      metadata: {
        archived: true,
        archivedAt: new Date().toISOString()
      }
    }
  });
  
  console.log(`   Archived ${result.count} old agent configurations`);
  return result.count;
}

/**
 * Cleanup sensitive data from old records
 * Remove PII while keeping analytics data
 */
async function sanitizeOldData() {
  console.log('🔒 Sanitizing old sensitive data...');
  
  const cutoffDate = getCutoffDate(90); // 3 months
  
  // Remove detailed transcripts but keep turn counts and timings
  const transcriptResult = await prisma.turn.updateMany({
    where: {
      createdAt: {
        lt: cutoffDate
      },
      OR: [
        { transcriptIn: { not: null } },
        { transcriptOut: { not: null } }
      ]
    },
    data: {
      transcriptIn: null,
      transcriptOut: null
    }
  });
  
  // Sanitize phone numbers in old calls but keep for recent ones
  const phoneResult = await prisma.call.updateMany({
    where: {
      createdAt: {
        lt: cutoffDate
      },
      callerPhone: {
        not: null
      }
    },
    data: {
      callerPhone: 'REDACTED'
    }
  });
  
  console.log(`   Sanitized ${transcriptResult.count} turn transcripts`);
  console.log(`   Sanitized ${phoneResult.count} caller phone numbers`);
  
  return transcriptResult.count + phoneResult.count;
}

/**
 * Database maintenance tasks
 */
async function performMaintenance() {
  console.log('🔧 Performing database maintenance...');
  
  // Analyze tables to update statistics
  const tables = ['Call', 'Turn', 'CallEvent', 'Appointment', 'AgentConfig'];
  
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`ANALYZE "${table}"`);
  }
  
  // Vacuum to reclaim space (non-blocking)
  await prisma.$executeRawUnsafe('VACUUM (ANALYZE)');
  
  console.log('   Database maintenance completed');
}

/**
 * Generate cleanup report
 */
async function generateCleanupReport() {
  const now = new Date();
  
  const stats = await prisma.$queryRaw`
    SELECT 
      'calls' as table_name,
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE "createdAt" < ${getCutoffDate(RETENTION_POLICIES.CALL_DATA)}) as eligible_for_cleanup
    FROM "Call"
    
    UNION ALL
    
    SELECT 
      'turns' as table_name,
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE "createdAt" < ${getCutoffDate(RETENTION_POLICIES.TURN_DATA)}) as eligible_for_cleanup
    FROM "Turn"
    
    UNION ALL
    
    SELECT 
      'call_events' as table_name,
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE "timestamp" < ${getCutoffDate(RETENTION_POLICIES.CALL_EVENTS)}) as eligible_for_cleanup
    FROM "CallEvent"
    
    UNION ALL
    
    SELECT 
      'appointments' as table_name,
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE "createdAt" < ${getCutoffDate(RETENTION_POLICIES.COMPLETED_APPOINTMENTS)}) as eligible_for_cleanup
    FROM "Appointment"
    WHERE "status" IN ('completed', 'cancelled', 'no_show')
  `;
  
  console.log('\n📊 Cleanup Report');
  console.log('==================');
  console.table(stats);
}

/**
 * Main cleanup function
 */
async function runCleanup(options = {}) {
  const startTime = Date.now();
  
  console.log(`🧹 Starting data retention cleanup at ${new Date().toISOString()}`);
  console.log('Retention policies:', RETENTION_POLICIES);
  
  try {
    let totalDeleted = 0;
    
    if (!options.skipReport) {
      await generateCleanupReport();
    }
    
    if (!options.dryRun) {
      // Order matters: events first, then turns, then calls (cascade prevention)
      totalDeleted += await cleanupCallEvents();
      totalDeleted += await cleanupTurns();
      totalDeleted += await cleanupCalls();
      totalDeleted += await cleanupCompletedAppointments();
      
      await archiveOldAgentConfigs();
      
      if (!options.skipSanitization) {
        await sanitizeOldData();
      }
      
      if (!options.skipMaintenance) {
        await performMaintenance();
      }
    } else {
      console.log('🔍 DRY RUN - No data will be deleted');
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Cleanup completed in ${duration}ms`);
    console.log(`   Total records deleted: ${totalDeleted}`);
    
    return {
      success: true,
      duration,
      totalDeleted,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Schedule automatic cleanup
 */
function scheduleCleanup() {
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Scheduled cleanup starting...');
    await runCleanup();
  }, {
    timezone: "America/New_York"
  });
  
  // Weekly maintenance on Sundays at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('⏰ Weekly maintenance starting...');
    await runCleanup({ skipSanitization: false });
  }, {
    timezone: "America/New_York"
  });
  
  console.log('📅 Cleanup jobs scheduled');
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    skipReport: args.includes('--skip-report'),
    skipSanitization: args.includes('--skip-sanitization'),
    skipMaintenance: args.includes('--skip-maintenance')
  };
  
  if (args.includes('--schedule')) {
    scheduleCleanup();
    console.log('Scheduler started. Press Ctrl+C to stop.');
    // Keep process alive
    process.stdin.resume();
  } else {
    await runCleanup(options);
  }
}

// Export for use in other scripts
module.exports = {
  runCleanup,
  scheduleCleanup,
  RETENTION_POLICIES
};

// Run if called directly
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}