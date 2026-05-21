import { ServiceBusClient } from "@azure/service-bus";
import { generateReportDraft } from "../lib/mock-agent";
import {
  getInputJson,
  saveAiDraft,
  updateReportStatus,
} from "../lib/report-repository";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is not set");
if (!queueName) throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is not set");

async function main() {
  const client = new ServiceBusClient(connectionString!);
  const receiver = client.createReceiver(queueName!);

  console.log(`report worker started. queue=${queueName}`);

  receiver.subscribe({
    processMessage: async (message) => {
      const reportId = message.body?.reportId as string | undefined;
      if (!reportId) {
        console.warn("message missing reportId:", message.body);
        return;
      }

      console.log(`[${reportId}] start`);

      try {
        await updateReportStatus(reportId, "generating_report");

        const input = await getInputJson(reportId);
        if (!input) throw new Error(`input not found: ${reportId}`);

        const draft = await generateReportDraft(input);
        draft.id = reportId;
        draft.status = "waiting_human_review";

        await saveAiDraft(reportId, draft);
        console.log(`[${reportId}] completed`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error(`[${reportId}] failed:`, err);
        await updateReportStatus(reportId, "failed", msg);
        throw err;
      }
    },
    processError: async (args) => {
      console.error("service bus error:", args.error);
    },
  });

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. shutting down...");
    await receiver.close();
    await client.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
