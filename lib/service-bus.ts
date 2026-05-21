import { ServiceBusClient } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME;

if (!connectionString) {
  throw new Error("SERVICE_BUS_CONNECTION_STRING is not set");
}

if (!queueName) {
  throw new Error("SERVICE_BUS_REPORT_QUEUE_NAME is not set");
}

export const serviceBusClient = new ServiceBusClient(connectionString);
export const reportQueueName = queueName;

export async function enqueueReportGeneration(reportId: string): Promise<void> {
  const sender = serviceBusClient.createSender(reportQueueName);
  try {
    await sender.sendMessages({
      body: { reportId },
      contentType: "application/json",
      subject: "report.generate",
      messageId: reportId,
    });
  } finally {
    await sender.close();
  }
}
