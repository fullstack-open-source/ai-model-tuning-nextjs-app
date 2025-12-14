import { Pool, PoolClient, QueryResult } from "pg";
import { logger } from "@lib/logger/logger";

type PostgresConfig = {
  host: string;
  database: string;
  user: string;
  password: string;
  port?: number;
};

export class PostgresConnection {
  private pool: Pool;
  private client: PoolClient | null = null;

  constructor(config: PostgresConfig) {
    this.pool = new Pool({
      host: config.host,
      database: config.database,
      user: config.user,
      password: config.password,
      port: config.port || 5432,
      max: 10, // max clients in pool
      idleTimeoutMillis: 30000,
    });
  }

  // Get a client from the pool
  private async getClient(): Promise<PoolClient> {
    if (!this.client) {
      this.client = await this.pool.connect();
    }
    return this.client;
  }

  // Execute a query (auto handles connection)
  public async query<T extends Record<string, any> = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const client = await this.getClient();
    try {
      const result = await client.query<T>(text, params);
      return result;
    } catch (error) {
      logger.error(`Query failed: ${error}`, { module: "Postgres" });
      throw error;
    }
  }

  // Transaction helper
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error(`Transaction failed: ${err}`, { module: "Postgres" });
      throw err;
    } finally {
      client.release();
      this.client = null;
    }
  }

  // Close pool
  public async close() {
    await this.pool.end();
    this.client = null;
  }
}
