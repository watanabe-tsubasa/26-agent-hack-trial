import { reindexAllReports } from "../lib/report-rag/index-report";
import { isReportRagEnabled } from "../lib/report-rag/cosmos-rag";
import { getDbPool } from "../lib/db";

async function main() {
  if (!isReportRagEnabled()) {
    console.error(
      "Cosmos RAG is not enabled. Set COSMOS_ENDPOINT/COSMOS_KEY and COSMOS_RAG_CONTAINER."
    );
    process.exit(1);
  }
  const force = process.argv.includes("--force");
  console.log(`reindex starting (force=${force})...`);
  const result = await reindexAllReports({ force });
  console.log(`reindex done: indexed=${result.indexed} skipped=${result.skipped} failed=${result.failed}`);
  const pool = await getDbPool();
  pool.close();
}

main().catch((err) => {
  console.error("reindex failed:", err);
  process.exit(1);
});
