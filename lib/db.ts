import sql from "mssql";

let poolPromise: Promise<sql.ConnectionPool> | undefined;

export function getDbPool(): Promise<sql.ConnectionPool> {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
 
  if (!poolPromise) {
    poolPromise = sql.connect(connectionString!);
  }
  return poolPromise;
}

export { sql };
