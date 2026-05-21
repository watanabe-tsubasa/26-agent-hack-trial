import { getDbPool, sql } from "../lib/db";

async function migrate() {
  const pool = await getDbPool();

  console.log("running migration...");

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'reports'
    )
    create table reports (
      id            nvarchar(64)  primary key,
      status        nvarchar(64)  not null,
      summary       nvarchar(max) not null,
      input_json    nvarchar(max) not null,
      ai_draft_json nvarchar(max) null,
      user_draft_json nvarchar(max) null,
      feedbacks_json  nvarchar(max) null,
      error_message   nvarchar(max) null,
      created_at    datetime2 not null default sysutcdatetime(),
      updated_at    datetime2 not null default sysutcdatetime()
    )
  `);
  console.log("  ✓ table reports");

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'agent_runs'
    )
    create table agent_runs (
      id           nvarchar(64)  primary key,
      report_id    nvarchar(64)  not null,
      status       nvarchar(64)  not null,
      current_step nvarchar(128) null,
      steps_json   nvarchar(max) null,
      started_at   datetime2 not null default sysutcdatetime(),
      completed_at datetime2 null,
      error_message nvarchar(max) null
    )
  `);
  console.log("  ✓ table agent_runs");

  console.log("migration completed.");
  pool.close();
}

migrate().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
