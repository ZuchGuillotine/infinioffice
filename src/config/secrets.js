const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

class SecretsManager {
  constructor() {
    this.client = null;
    this.cachedSecrets = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Initialize AWS Secrets Manager client
   */
  initializeClient() {
    if (!this.client) {
      // App Runner automatically provides AWS credentials
      this.client = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'us-west-2'
      });
    }
    return this.client;
  }

  /**
   * Get secret value from AWS Secrets Manager
   * @param {string} secretId - The secret identifier (ARN or name)
   * @returns {object} - Parsed secret value
   */
  async getSecret(secretId) {
    const cacheKey = secretId;
    
    // Check cache first
    if (this.cachedSecrets.has(cacheKey)) {
      const cached = this.cachedSecrets.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🔑 Using cached secret for:', secretId);
        return cached.value;
      }
      this.cachedSecrets.delete(cacheKey);
    }

    try {
      const client = this.initializeClient();
      const command = new GetSecretValueCommand({
        SecretId: secretId
      });

      console.log('🔑 Fetching secret from AWS Secrets Manager:', secretId);
      const response = await client.send(command);
      
      let secretValue;
      if (response.SecretString) {
        secretValue = JSON.parse(response.SecretString);
      } else if (response.SecretBinary) {
        // Handle binary secrets if needed
        secretValue = Buffer.from(response.SecretBinary, 'base64').toString('ascii');
      } else {
        throw new Error('Secret value not found in response');
      }

      // Cache the secret
      this.cachedSecrets.set(cacheKey, {
        value: secretValue,
        timestamp: Date.now()
      });

      console.log('✅ Successfully retrieved secret from Secrets Manager');
      return secretValue;

    } catch (error) {
      console.error('❌ Error fetching secret from Secrets Manager:', error);
      throw error;
    }
  }

  /**
   * Get database connection URL from secrets
   * @param {string} secretId - The database secret identifier
   * @returns {string} - Database connection URL
   */
  async getDatabaseUrl(secretId) {
    try {
      const secret = await this.getSecret(secretId);
      
      // Standard RDS secret format
      const { username, password, engine, host, port, dbname } = secret;
      
      if (!username || !password || !host || !port) {
        throw new Error('Database secret missing required fields');
      }

      const databaseUrl = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname || 'postgres'}`;
      console.log('🔗 Constructed database URL from secret');
      return databaseUrl;

    } catch (error) {
      console.error('❌ Error constructing database URL from secret:', error);
      throw error;
    }
  }

  /**
   * Clear cached secrets (useful for rotation scenarios)
   */
  clearCache() {
    this.cachedSecrets.clear();
    console.log('🗑️ Cleared secrets cache');
  }

  /**
   * Check if running in AWS environment
   * @returns {boolean}
   */
  isAwsEnvironment() {
    return !!(
      process.env.AWS_REGION ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.ECS_CONTAINER_METADATA_URI ||
      process.env.AWS_APP_RUNNER_SERVICE_ARN
    );
  }
}

/**
 * Get database URL with fallback logic
 * Priority: Secrets Manager > Environment Variable
 */
async function getDatabaseUrl() {
  const secretsManager = new SecretsManager();
  
  // In production (AWS environment), try Secrets Manager first
  if (process.env.NODE_ENV === 'production' && secretsManager.isAwsEnvironment()) {
    const dbSecretId = process.env.DB_SECRET_ID || process.env.DATABASE_SECRET_ARN;
    
    if (dbSecretId) {
      try {
        console.log('🔄 Attempting to get database URL from Secrets Manager...');
        return await secretsManager.getDatabaseUrl(dbSecretId);
      } catch (error) {
        console.warn('⚠️ Failed to get database URL from Secrets Manager, falling back to env var:', error.message);
      }
    } else {
      console.log('ℹ️ No DB_SECRET_ID or DATABASE_SECRET_ARN provided, using environment variable');
    }
  }

  // Fallback to environment variable
  const envDatabaseUrl = process.env.DATABASE_URL;
  if (envDatabaseUrl) {
    console.log('🔗 Using database URL from environment variable');
    return envDatabaseUrl;
  }

  throw new Error('No database URL available from Secrets Manager or environment variables');
}

/**
 * Get all application secrets with fallback logic
 */
async function getApplicationSecrets() {
  const secretsManager = new SecretsManager();
  const secrets = {};

  // Database URL
  try {
    secrets.DATABASE_URL = await getDatabaseUrl();
  } catch (error) {
    console.error('❌ Failed to get database URL:', error);
  }

  // Other secrets (could be extended for API keys, etc.)
  const secretMappings = {
    JWT_SECRET: process.env.JWT_SECRET_ID,
    OPENAI_API_KEY: process.env.OPENAI_SECRET_ID,
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_SECRET_ID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_SECRET_ID
  };

  for (const [envVar, secretId] of Object.entries(secretMappings)) {
    if (secretId && secretsManager.isAwsEnvironment()) {
      try {
        const secret = await secretsManager.getSecret(secretId);
        secrets[envVar] = secret.value || secret;
      } catch (error) {
        console.warn(`⚠️ Failed to get ${envVar} from Secrets Manager, using env var:`, error.message);
        secrets[envVar] = process.env[envVar];
      }
    } else {
      secrets[envVar] = process.env[envVar];
    }
  }

  return secrets;
}

module.exports = {
  SecretsManager,
  getDatabaseUrl,
  getApplicationSecrets
};