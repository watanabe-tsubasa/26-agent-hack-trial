import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";
import { generateReportDraft } from "../lib/mock-agent";
import {
  getInputJson,
  saveAiDraft,
  updateReportStatus,
} from "../lib/report-repository";
import {
  parsePromptImprovementMessage,
  parseReportGenerationMessage,
} from "../lib/job-messages";
import { runPromptImprovementJob } from "../lib/prompt-improvement-processor";
import { markPromptImprovementRunRunning } from "../lib/prompt-improvement-run-repository";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const reportQueueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;
const promptImprovementQueueName =
  process.env.SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is not set");
if (!reportQueueName) throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is not set");

async function handleReportMessage(body: unknown): Promise<void> {
  const parsed = parseReportGenerationMessage(body);
  if (!parsed) {
    console.warn("[report] invalid message body, skipping:", body);
    return;
  }

  const { reportId } = parsed;
  console.log(`[report:${reportId}] start`);

  try {
    await updateReportStatus(reportId, "generating_report");

    const input = await getInputJson(reportId);
    if (!input) throw new Error(`input not found: ${reportId}`);

    const draft = await generateReportDraft(input);
    draft.id = reportId;
    draft.status = "waiting_human_review";

    await saveAiDraft(reportId, draft);
    console.log(`[report:${reportId}] completed`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[report:${reportId}] failed:`, err);
    await updateReportStatus(reportId, "failed", msg);
    throw err;
  }
}

async function handlePromptImprovementMessage(body: unknown): Promise<void> {
  const parsed = parsePromptImprovementMessage(body);
  if (!parsed) {
    console.warn("[prompt-improvement] invalid message body, skipping:", body);
    return;
  }

  const { runId, locationKey } = parsed;
  console.log(`[prompt-improvement:${runId}] start locationKey=${locationKey}`);

  try {
    await markPromptImprovementRunRunning(runId);
    await runPromptImprovementJob({ runId, locationKey });
    console.log(`[prompt-improvement:${runId}] completed locationKey=${locationKey}`);
  } catch (err) {
    console.error(
      `[prompt-improvement:${runId}] failed locationKey=${locationKey}:`,
      err
    );
    throw err;
  }
}

function startReceiver(
  client: ServiceBusClient,
  queueName: string,
  label: string,
  handler: (body: unknown) => Promise<void>
): ServiceBusReceiver {
  const receiver = client.createReceiver(queueName);
  console.log(`${label} worker started. queue=${queueName}`);

  receiver.subscribe({
    processMessage: async (message) => {
      await handler(message.body);
    },
    processError: async (args) => {
      console.error(`${label} service bus error:`, args.error);
    },
  });

  return receiver;
}

async function main() {
  const client = new ServiceBusClient(connectionString!);
  const receivers: ServiceBusReceiver[] = [];

  receivers.push(
    startReceiver(client, reportQueueName!, "[report]", handleReportMessage)
  );

  if (promptImprovementQueueName) {
    receivers.push(
      startReceiver(
        client,
        promptImprovementQueueName,
        "[prompt-improvement]",
        handlePromptImprovementMessage
      )
    );
  } else {
    console.warn(
      "SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME is not set. Prompt-improvement queue listener disabled."
    );
  }

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. shutting down...");
    await Promise.all(receivers.map((r) => r.close()));
    await client.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
