const { PrismaClient } = require('@prisma/client');
const { getDatabaseUrl } = require('./secrets');

class DatabaseManager {
  constructor() {
    this.prisma = null;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.isInitialized = false;
  }

  /**
   * Initialize Prisma client with dynamic database URL
   */
  async initialize() {
    if (this.isInitialized && this.prisma) {
      return this.prisma;
    }

    try {
      console.log('🔄 Initializing database connection...');
      
      // Get database URL (with Secrets Manager fallback)
      const databaseUrl = await getDatabaseUrl();
      
      // Create Prisma client with optimized connection pooling
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl
          }
        },
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
        // Optimize connection pool for lower latency
        __internal: {
          engine: {
            schema: undefined,
            queryEngineType: 'binary',
            config: {
              pool: {
                maxConnections: process.env.NODE_ENV === 'production' ? 15 : 30,  // Reduced for App Runner
                minConnections: process.env.NODE_ENV === 'production' ? 5 : 10,   // Conservative for serverless
                maxIdleTime: 30000,  // 30 seconds
                connectionTimeout: 5000  // 5 second timeout
              }
            }
          }
        }
      });

      // Test connection and pre-warm
      await this.prisma.$connect();
      
      // Pre-warm critical queries for faster first-call performance
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connection established successfully');
        
        // Pre-warm organization lookup query to optimize first call
        console.log('🔥 Pre-warming organization lookup queries...');
        await this.prisma.organization.findFirst({ take: 1 });
        console.log('✅ Database queries pre-warmed');
      } catch (warmupError) {
        console.warn('⚠️ Database pre-warming failed (non-critical):', warmupError.message);
      }
      
      this.isInitialized = true;
      this.connectionRetries = 0;
      
      return this.prisma;

    } catch (error) {
      console.error('❌ Failed to initialize database connection:', error);
      
      this.connectionRetries++;
      if (this.connectionRetries < this.maxRetries) {
        console.log(`🔄 Retrying database connection (${this.connectionRetries}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * this.connectionRetries)); // Exponential backoff
        return this.initialize();
      }
      
      throw error;
    }
  }

  /**
   * Get Prisma client instance
   */
  async getClient() {
    if (!this.isInitialized || !this.prisma) {
      return this.initialize();
    }
    return this.prisma;
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      if (!this.prisma) {
        await this.initialize();
      }
      
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', connected: true };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { 
        status: 'unhealthy', 
        connected: false, 
        error: error.message 
      };
    }
  }

  /**
   * Gracefully disconnect from database
   */
  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      console.log('🔌 Database connection closed');
      this.isInitialized = false;
      this.prisma = null;
    }
  }

  /**
   * Reconnect to database (useful for credential rotation)
   */
  async reconnect() {
    console.log('🔄 Reconnecting to database...');
    await this.disconnect();
    return this.initialize();
  }
}

// Global database manager instance
const databaseManager = new DatabaseManager();

/**
 * Get database client with automatic initialization
 */
async function getDatabase() {
  return databaseManager.getClient();
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
  await databaseManager.disconnect();
}

// Handle process shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  DatabaseManager,
  databaseManager,
  getDatabase,
  gracefulShutdown
};