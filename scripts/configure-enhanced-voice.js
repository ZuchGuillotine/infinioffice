#!/usr/bin/env node

/**
 * Enhanced Voice Agent Configuration Script
 * 
 * This script helps organizations configure their enhanced voice agent features.
 * Run with: node scripts/configure-enhanced-voice.js <organizationId>
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultEnhancedConfig = {
  enabled: true,
  features: {
    locationCapture: true,
    threeStrikeConfirmation: true,
    progressiveSummarization: true,
    digressionHandling: true,
    toolBasedLLM: true,
    enhancedTelemetry: true
  },
  performance: {
    maxTurnLatency: 1500,
    maxLLMLatency: 800,
    maxStateTransitionLatency: 50,
    maxBargeInResponse: 150
  },
  confirmationThresholds: {
    service: 3,
    timeWindow: 3,
    contact: 3,
    location: 3
  },
  escalation: {
    maxSilenceTimeouts: 2,
    maxRetries: 4,
    maxConfirmationAttempts: 3,
    escalationTriggers: ['timeout', 'max_retries', 'low_confidence', 'user_request']
  },
  fallback: {
    enableLegacyFallback: true,
    fallbackThreshold: 0.3,
    gracefulDegradation: true
  }
};

async function configureEnhancedVoice(organizationId) {
  try {
    console.log('🔧 Enhanced Voice Agent Configuration Tool');
    console.log('==========================================\n');

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { businessConfig: true }
    });

    if (!organization) {
      console.error('❌ Organization not found:', organizationId);
      process.exit(1);
    }

    console.log(`📋 Configuring enhanced voice for: ${organization.name}`);
    console.log(`📱 Phone number: ${organization.twilioNumber || 'Not configured'}\n`);

    // Get current configuration
    let currentConfig = organization.businessConfig?.enhancedVoiceConfig || defaultEnhancedConfig;
    
    console.log('Current configuration:');
    console.log(JSON.stringify(currentConfig, null, 2));
    console.log('\n');

    // Interactive configuration
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    // Feature flags
    console.log('🎯 Feature Configuration:');
    currentConfig.features.locationCapture = await question('Enable location capture? (y/n) [y]: ') === 'n' ? false : true;
    currentConfig.features.threeStrikeConfirmation = await question('Enable three-strike confirmation? (y/n) [y]: ') === 'n' ? false : true;
    currentConfig.features.progressiveSummarization = await question('Enable progressive summarization? (y/n) [y]: ') === 'n' ? false : true;
    currentConfig.features.digressionHandling = await question('Enable digression handling? (y/n) [y]: ') === 'n' ? false : true;
    currentConfig.features.toolBasedLLM = await question('Enable tool-based LLM? (y/n) [y]: ') === 'n' ? false : true;
    currentConfig.features.enhancedTelemetry = await question('Enable enhanced telemetry? (y/n) [y]: ') === 'n' ? false : true;

    console.log('\n⚡ Performance Configuration:');
    currentConfig.performance.maxTurnLatency = parseInt(await question('Max turn latency (ms) [1500]: ') || '1500');
    currentConfig.performance.maxLLMLatency = parseInt(await question('Max LLM latency (ms) [800]: ') || '800');
    currentConfig.performance.maxStateTransitionLatency = parseInt(await question('Max state transition latency (ms) [50]: ') || '50');
    currentConfig.performance.maxBargeInResponse = parseInt(await question('Max barge-in response time (ms) [150]: ') || '150');

    console.log('\n🔄 Confirmation Thresholds:');
    currentConfig.confirmationThresholds.service = parseInt(await question('Service confirmation attempts [3]: ') || '3');
    currentConfig.confirmationThresholds.timeWindow = parseInt(await question('Time window confirmation attempts [3]: ') || '3');
    currentConfig.confirmationThresholds.contact = parseInt(await question('Contact confirmation attempts [3]: ') || '3');
    currentConfig.confirmationThresholds.location = parseInt(await question('Location confirmation attempts [3]: ') || '3');

    console.log('\n📞 Escalation Rules:');
    currentConfig.escalation.maxSilenceTimeouts = parseInt(await question('Max silence timeouts [2]: ') || '2');
    currentConfig.escalation.maxRetries = parseInt(await question('Max retries [4]: ') || '4');
    currentConfig.escalation.maxConfirmationAttempts = parseInt(await question('Max confirmation attempts [3]: ') || '3');

    console.log('\n🛡️ Fallback Configuration:');
    currentConfig.fallback.enableLegacyFallback = await question('Enable legacy fallback? (y/n) [y]: ') === 'n' ? false : true;
    currentConfig.fallback.fallbackThreshold = parseFloat(await question('Fallback confidence threshold [0.3]: ') || '0.3');
    currentConfig.fallback.gracefulDegradation = await question('Enable graceful degradation? (y/n) [y]: ') === 'n' ? false : true;

    // Overall enable/disable
    console.log('\n🚀 Overall Configuration:');
    currentConfig.enabled = await question('Enable enhanced voice features? (y/n) [y]: ') === 'n' ? false : true;

    rl.close();

    console.log('\n📝 Final Configuration:');
    console.log(JSON.stringify(currentConfig, null, 2));

    // Confirm and save
    const confirm = await question('\n💾 Save this configuration? (y/n): ');
    if (confirm.toLowerCase() === 'y') {
      // Update or create business config
      if (organization.businessConfig) {
        await prisma.businessConfig.update({
          where: { organizationId },
          data: { enhancedVoiceConfig: currentConfig }
        });
      } else {
        await prisma.businessConfig.create({
          data: {
            organizationId,
            enhancedVoiceConfig: currentConfig
          }
        });
      }

      console.log('✅ Enhanced voice configuration saved successfully!');
      console.log('\n🔍 To test the configuration:');
      console.log('1. Make a call to your Twilio number');
      console.log('2. Check the logs for enhanced voice pipeline initialization');
      console.log('3. Monitor performance metrics at /health/enhanced-voice');
    } else {
      console.log('❌ Configuration not saved');
    }

  } catch (error) {
    console.error('❌ Error configuring enhanced voice:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
if (require.main === module) {
  const organizationId = process.argv[2];
  
  if (!organizationId) {
    console.error('Usage: node scripts/configure-enhanced-voice.js <organizationId>');
    console.error('Example: node scripts/configure-enhanced-voice.js 123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  configureEnhancedVoice(organizationId);
}

module.exports = { configureEnhancedVoice };
