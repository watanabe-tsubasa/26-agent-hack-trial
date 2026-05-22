import { ServiceBusClient } from "@azure/service-bus";
import type { PromptImprovementJobMessage } from "./job-messages";

function getConnectionString(): string {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("SERVICE_BUS_CONNECTION_STRING is not set");
  }
  return connectionString;
}

function getReportQueueName(): string {
  const queueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;
  if (!queueName) {
    throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is not set");
  }
  return queueName;
}

function getPromptImprovementQueueName(): string {
  const queueName = process.env.SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME;
  if (!queueName) {
    throw new Error("SERVICE_BUS_PROMPT_IMPROVEMENT_QUEUE_NAME is not set");
  }
  return queueName;
}

export async function enqueueReportGeneration(reportId: string): Promise<void> {
  const connectionString = getConnectionString();
  const queueName = getReportQueueName();

  const client = new ServiceBusClient(connectionString);
  const sender = client.createSender(queueName);

  try {
    await sender.sendMessages({
      body: { reportId },
      contentType: "application/json",
      subject: "report.generate",
      messageId: reportId,
    });
  } finally {
    await sender.close();
    await client.close();
  }
}

export async function enqueuePromptImprovement(
  message: PromptImprovementJobMessage
): Promise<void> {
  const connectionString = getConnectionString();
  const queueName = getPromptImprovementQueueName();

  const client = new ServiceBusClient(connectionString);
  const sender = client.createSender(queueName);

  try {
    await sender.sendMessages({
      body: message,
      contentType: "application/json",
      subject: "prompt-improvement.run",
      messageId: message.runId,
    });
  } finally {
    await sender.close();
    await client.close();
  }
}
