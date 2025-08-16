/**
 * Enhanced Voice Agent Configuration
 * 
 * This file contains configuration options for the enhanced voice agent features.
 * Organizations can customize these settings through their business configuration.
 */

const defaultEnhancedConfig = {
  // Feature flags
  features: {
    locationCapture: true,
    threeStrikeConfirmation: true,
    progressiveSummarization: true,
    digressionHandling: true,
    toolBasedLLM: true,
    enhancedTelemetry: true
  },
  
  // Performance targets
  performance: {
    maxTurnLatency: 1500, // 1.5 seconds
    maxLLMLatency: 800,   // 800ms
    maxStateTransitionLatency: 50, // 50ms
    maxBargeInResponse: 150 // 150ms
  },
  
  // Confirmation thresholds (can be overridden per organization)
  confirmationThresholds: {
    service: 3,
    timeWindow: 3,
    contact: 3,
    location: 3
  },
  
  // Escalation rules
  escalation: {
    maxSilenceTimeouts: 2,
    maxRetries: 4,
    maxConfirmationAttempts: 3,
    escalationTriggers: ['timeout', 'max_retries', 'low_confidence', 'user_request']
  },
  
  // Fallback settings
  fallback: {
    enableLegacyFallback: true,
    fallbackThreshold: 0.3, // Confidence threshold for fallback
    gracefulDegradation: true
  }
};

/**
 * Get enhanced configuration for an organization
 * @param {Object} organizationContext - Organization context with business config
 * @returns {Object} - Merged configuration with organization overrides
 */
function getEnhancedConfig(organizationContext) {
  if (!organizationContext?.businessConfig?.enhancedVoiceConfig) {
    return defaultEnhancedConfig;
  }
  
  const orgConfig = organizationContext.businessConfig.enhancedVoiceConfig;
  
  return {
    ...defaultEnhancedConfig,
    ...orgConfig,
    features: {
      ...defaultEnhancedConfig.features,
      ...orgConfig.features
    },
    performance: {
      ...defaultEnhancedConfig.performance,
      ...orgConfig.performance
    },
    confirmationThresholds: {
      ...defaultEnhancedConfig.confirmationThresholds,
      ...orgConfig.confirmationThresholds
    },
    escalation: {
      ...defaultEnhancedConfig.escalation,
      ...orgConfig.escalation
    },
    fallback: {
      ...defaultEnhancedConfig.fallback,
      ...orgConfig.fallback
    }
  };
}

/**
 * Check if enhanced features are enabled for an organization
 * @param {Object} organizationContext - Organization context
 * @returns {boolean} - Whether enhanced features are enabled
 */
function isEnhancedEnabled(organizationContext) {
  if (!organizationContext?.businessConfig?.enhancedVoiceConfig) {
    return true; // Default to enabled
  }
  
  return organizationContext.businessConfig.enhancedVoiceConfig.enabled !== false;
}

/**
 * Get organization-specific confirmation thresholds
 * @param {Object} organizationContext - Organization context
 * @returns {Object} - Confirmation thresholds
 */
function getConfirmationThresholds(organizationContext) {
  const config = getEnhancedConfig(organizationContext);
  return config.confirmationThresholds;
}

/**
 * Get organization-specific performance targets
 * @param {Object} organizationContext - Organization context
 * @returns {Object} - Performance targets
 */
function getPerformanceTargets(organizationContext) {
  const config = getEnhancedConfig(organizationContext);
  return config.performance;
}

module.exports = {
  defaultEnhancedConfig,
  getEnhancedConfig,
  isEnhancedEnabled,
  getConfirmationThresholds,
  getPerformanceTargets
};
