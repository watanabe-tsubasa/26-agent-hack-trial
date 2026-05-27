import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";
import { handlePromptImprovementMessage, handleReportMessage } from "./handlers";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const reportQueueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;
const promptImprovementQueueName =
  process.env.SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is not set");
if (!reportQueueName) throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is not set");

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
