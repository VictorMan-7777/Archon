/**
 * Database connection management
 *
 * Strategy:
 * - DATABASE_URL is required
 * - PostgreSQL only
 * - SQLite fallback disabled
 */
import type { IDatabase, SqlDialect, QueryResult } from './adapters/types';
import { PostgresAdapter, postgresDialect } from './adapters/postgres';
import { createLogger } from '@archon/paths';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('db.connection');
  return cachedLog;
}

// Singleton database instance
let database: IDatabase | null = null;
let dialect: SqlDialect | null = null;

/**
 * Get or create the database connection
 * Requires PostgreSQL DATABASE_URL; SQLite fallback is disabled
 */
export function getDatabase(): IDatabase {
  if (database) {
    return database;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. This Archon deployment is configured for PostgreSQL only; SQLite fallback is disabled.'
    );
  }

  getLog().info('db.connection_postgresql_selected');
  database = new PostgresAdapter(process.env.DATABASE_URL);
  dialect = postgresDialect;

  return database;
}

/**
 * Get the SQL dialect for the current database
 */
export function getDialect(): SqlDialect {
  if (!dialect) {
    // Initialize database to set dialect
    getDatabase();
  }

  if (!dialect) {
    throw new Error(
      'Database dialect not initialized. This indicates the database connection failed during initialization. ' +
        'Check logs for database connection errors.'
    );
  }

  return dialect;
}

/**
 * Get the current database type without initializing the database
 * Useful for version/info commands that don't need a connection
 */
export function getDatabaseType(): 'postgresql' {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. SQLite fallback is disabled.');
  }
  return 'postgresql';
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.close();
    database = null;
    dialect = null;
  }
}

/**
 * Reset database for testing
 */
export function resetDatabase(): void {
  database = null;
  dialect = null;
}

// Legacy export for backward compatibility during migration
// This provides a pool-like interface that forwards to getDatabase()
export const pool = {
  query: async <T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
    return getDatabase().query<T>(sql, params);
  },
  end: async (): Promise<void> => {
    await closeDatabase();
  },
};
