import sql from "mssql";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

export function getDbPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = sql.connect(connectionString!);
  }
  return poolPromise;
}

export { sql };
