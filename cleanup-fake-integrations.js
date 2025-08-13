/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 10/08/2025 - 21:25:08
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 10/08/2025
    * - Author          : 
    * - Modification    : 
**/
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupFakeIntegrations() {
  console.log('🧹 Cleaning up fake calendar integrations...\n');
  
  try {
    // Find fake integrations (no OAuth tokens or empty tokens)
    const fakeIntegrations = await prisma.integration.findMany({
      where: {
        type: { in: ['apple-calendar', 'outlook-calendar'] },
        OR: [
          { oauthTokens: null },
          { oauthTokens: {} }
        ]
      }
    });
    
    if (fakeIntegrations.length === 0) {
      console.log('✅ No fake integrations found to clean up');
      return;
    }
    
    console.log(`📋 Found ${fakeIntegrations.length} fake integrations:`);
    fakeIntegrations.forEach(integration => {
      console.log(`   - ${integration.type} for organization ${integration.organizationId}`);
    });
    
    // Delete fake integrations
    const deleteResult = await prisma.integration.deleteMany({
      where: {
        type: { in: ['apple-calendar', 'outlook-calendar'] },
        OR: [
          { oauthTokens: null },
          { oauthTokens: {} }
        ]
      }
    });
    
    console.log(`\n🗑️  Deleted ${deleteResult.count} fake integrations`);
    console.log('✅ Cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Show current integration status
async function showIntegrationStatus() {
  console.log('\n📊 Current Integration Status:\n');
  
  try {
    const allIntegrations = await prisma.integration.findMany({
      select: {
        type: true,
        status: true,
        organizationId: true,
        oauthTokens: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (allIntegrations.length === 0) {
      console.log('📭 No integrations found in database');
      return;
    }
    
    console.log('Current Integrations:');
    allIntegrations.forEach(integration => {
      const hasTokens = integration.oauthTokens && Object.keys(integration.oauthTokens).length > 0;
      const tokenStatus = hasTokens ? '✅ Has OAuth tokens' : '❌ No OAuth tokens';
      console.log(`   - ${integration.type} (${integration.status}) - ${tokenStatus}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking integration status:', error);
  }
}

async function main() {
  await cleanupFakeIntegrations();
  await showIntegrationStatus();
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Test Google Calendar OAuth flow');
  console.log('2. Verify calendar data fetching works');
  console.log('3. Apple Calendar and Outlook Calendar now show "Coming Soon"');
  console.log('4. Focus on completing Google Calendar integration');
  
  await prisma.$disconnect();
}

main().catch(console.error);
