export type PostgresConfig = {
  host: string;
  database: string;
  user: string;
  password: string;
  port?: number;
};

export enum JoinType {
  INNER = "INNER",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
  FULL = "FULL OUTER",
}
