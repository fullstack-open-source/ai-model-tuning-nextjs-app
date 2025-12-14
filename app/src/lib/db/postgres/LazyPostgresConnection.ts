import { PostgresConnection } from "@lib/db/postgres/postgres";
import { logger } from "@lib/logger/logger";
import { dbConfig } from "@lib/config/env";

type PostgresConfig = {
  host: string;
  database: string;
  user: string;
  password: string;
  port?: number;
};

export class LazyPostgresConnection {
  private static instance: PostgresConnection | null = null;
  private static maxRetries = 10;
  private static retryDelay = 2000; // milliseconds

  private static getConfig(): PostgresConfig | null {
    const host = dbConfig.host;
    const database = dbConfig.name;
    const user = dbConfig.user;
    const password = dbConfig.password;
    const port = dbConfig.port;

    const missingVars = [];
    if (!host) missingVars.push("DATABASE_HOST");
    if (!database) missingVars.push("DATABASE_NAME");
    if (!user) missingVars.push("DATABASE_USER");
    if (!password) missingVars.push("DATABASE_PASSWORD");

    if (missingVars.length > 0) {
      logger.warning(
        `Missing database environment variables: ${missingVars.join(", ")}`,
        { module: "Postgres" }
      );
      return null;
    }

    return { host, database, user, password, port };
  }

  private static async createConnection(
    retryCount = 0
  ): Promise<PostgresConnection | null> {
    const config = this.getConfig();
    if (!config) return null;

    try {
      const conn = new PostgresConnection(config);
      // Test connection
      await conn.query("SELECT 1");
      logger.success("Database connection established", { module: "Postgres" });
      return conn;
    } catch (err) {
      if (retryCount < this.maxRetries) {
        logger.warning(
          `Database connection attempt ${retryCount + 1} failed: ${err}. Retrying in ${
            this.retryDelay / 1000
          }s...`,
          { module: "Postgres" }
        );
        await new Promise((res) => setTimeout(res, this.retryDelay));
        return this.createConnection(retryCount + 1);
      } else {
        logger.error(
          `Failed to establish database connection after ${this.maxRetries} retries: ${err}`,
          { module: "Postgres" }
        );
        return null;
      }
    }
  }

  public static async getConnection(): Promise<PostgresConnection | null> {
    if (!this.instance) {
      this.instance = await this.createConnection();
    }
    return this.instance;
  }

  public static async resetConnection() {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}
