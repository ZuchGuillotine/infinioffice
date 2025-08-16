/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 16/08/2025 - 09:01:56
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 16/08/2025
    * - Author          : 
    * - Modification    : 
**/
/**
 * Database Configuration and Connection Management
 * 
 * Provides a single, optimized Prisma client instance with:
 * - Connection pooling for low latency
 * - Pre-warming for first-call performance
 * - Graceful error handling
 * - No circular dependencies
 */

const { PrismaClient } = require('@prisma/client');
const { getDatabaseUrl } = require('./secrets');

// Single global Prisma instance to avoid circular dependencies
let prisma = null;
let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize the database connection with optimized settings
 */
async function initializeDatabase() {
  if (isInitialized && prisma) {
    return prisma;
  }

  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('🔄 Initializing database connection...');
      
      // Get database URL
      const databaseUrl = await getDatabaseUrl();
      
      // Create Prisma client with optimized connection pooling
      prisma = new PrismaClient({
        datasources: {
          db: { url: databaseUrl }
        },
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        // Optimize connection pool for lower latency
        __internal: {
          engine: {
            schema: undefined,
            queryEngineType: 'binary',
            config: {
              pool: {
                maxConnections: process.env.NODE_ENV === 'production' ? 15 : 30,
                minConnections: process.env.NODE_ENV === 'production' ? 5 : 10,
                maxIdleTime: 30000,
                connectionTimeout: 5000
              }
            }
          }
        }
      });

      // Test connection with timeout
      const connectionPromise = prisma.$connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      );
      
      await Promise.race([connectionPromise, timeoutPromise]);
      
      // Simple connection test
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection established successfully');
      
      // Mark as initialized
      isInitialized = true;
      initializationPromise = null;
      
      return prisma;

    } catch (error) {
      console.error('❌ Failed to initialize database connection:', error);
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get database client (lazy initialization)
 */
async function getDatabase() {
  if (!prisma || !isInitialized) {
    return initializeDatabase();
  }
  return prisma;
}

/**
 * Pre-warm database for first-call performance
 */
async function prewarmDatabase() {
  try {
    if (!prisma || !isInitialized) {
      await initializeDatabase();
    }
    
    console.log('🔥 Pre-warming database for first-call performance...');
    
    // Test basic queries without complex joins to avoid hangs
    await prisma.$queryRaw`SELECT 1`;
    
    // Optional: Test a simple table query if available
    try {
      await prisma.$queryRaw`SELECT COUNT(*) FROM "Organization" LIMIT 1`;
      console.log('✅ Database pre-warming completed');
    } catch (warmupError) {
      console.log('ℹ️ Basic pre-warming completed (organization table not accessible yet)');
    }
    
  } catch (error) {
    console.warn('⚠️ Database pre-warming failed (non-critical):', error.message);
  }
}

/**
 * Health check for database connection
 */
async function healthCheck() {
  try {
    if (!prisma || !isInitialized) {
      await initializeDatabase();
    }
    
    await prisma.$queryRaw`SELECT 1`;
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
async function disconnect() {
  if (prisma) {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
    prisma = null;
    isInitialized = false;
    initializationPromise = null;
  }
}

// Handle process shutdown
process.on('SIGINT', disconnect);
process.on('SIGTERM', disconnect);

module.exports = {
  getDatabase,
  prewarmDatabase,
  healthCheck,
  disconnect,
  initializeDatabase
};