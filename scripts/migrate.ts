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

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'frame_assets'
    )
    create table frame_assets (
      id                    nvarchar(80)  not null primary key,
      video_asset_id        nvarchar(80)  null,
      facility_id           nvarchar(80)  not null,
      camera_id             nvarchar(80)  not null,
      camera_name           nvarchar(200) not null,
      location_name         nvarchar(200) not null,
      floor_label           nvarchar(50)  null,
      captured_at           datetime2     not null,
      frame_offset_seconds  int           null,
      frame_index           int           null,
      blob_container        nvarchar(100) not null,
      blob_name             nvarchar(500) not null,
      scenario_tags         nvarchar(max) null,
      description           nvarchar(max) null,
      created_at            datetime2     not null default sysutcdatetime()
    )
  `);
  console.log("  ✓ table frame_assets");

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'video_assets'
    )
    create table video_assets (
      id                nvarchar(80)  not null primary key,
      facility_id       nvarchar(80)  not null,
      camera_id         nvarchar(80)  not null,
      camera_name       nvarchar(200) not null,
      location_name     nvarchar(200) not null,
      floor_label       nvarchar(50)  null,
      recorded_start_at datetime2     not null,
      recorded_end_at   datetime2     not null,
      blob_container    nvarchar(100) not null,
      blob_name         nvarchar(500) not null,
      duration_seconds  int           null,
      status            nvarchar(50)  not null default 'uploaded',
      created_at        datetime2     not null default sysutcdatetime()
    )
  `);
  console.log("  ✓ table video_assets");

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'report_corrections'
    )
    create table report_corrections (
      id               nvarchar(64)  not null primary key,
      report_id        nvarchar(64)  not null,
      ai_draft_json    nvarchar(max) not null,
      user_draft_json  nvarchar(max) not null,
      diff_json        nvarchar(max) not null,
      correction_reason nvarchar(max) null,
      created_at       datetime2     not null default sysutcdatetime()
    )
  `);
  console.log("  ✓ table report_corrections");

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'location_prompt_overrides'
    )
    create table location_prompt_overrides (
      id            nvarchar(64)   not null primary key,
      location_key  nvarchar(128)  not null,
      title         nvarchar(200)  not null,
      override_text nvarchar(max)  not null,
      source        nvarchar(32)   not null,
      status        nvarchar(32)   not null default 'draft',
      analysis_json nvarchar(max)  null,
      created_at    datetime2      not null default sysutcdatetime(),
      approved_at   datetime2      null
    )
  `);
  console.log("  ✓ table location_prompt_overrides");

  await pool.request().query(`
    if not exists (
      select 1 from sys.tables where name = 'prompt_improvement_runs'
    )
    create table prompt_improvement_runs (
      id                     nvarchar(64)   not null primary key,
      location_key           nvarchar(128)  not null,
      status                 nvarchar(32)   not null,
      input_correction_count int            null,
      summary_json           nvarchar(max)  null,
      proposed_override_id   nvarchar(64)   null,
      created_at             datetime2      not null default sysutcdatetime(),
      completed_at           datetime2      null,
      error_message          nvarchar(max)  null
    )
  `);
  console.log("  ✓ table prompt_improvement_runs");

  console.log("migration completed.");
  pool.close();
}

migrate().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
