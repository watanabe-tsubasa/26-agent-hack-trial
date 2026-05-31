// service busのレポート生成キューのDLQを空にするスクリプト

import { ServiceBusClient } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING ?? "not-set";
const queueName = process.env.SERVICE_BUS_REPORT_QUEUE_NAME ?? "report-generation-requests";

if (!connectionString) {
  throw new Error("SERVICE_BUS_CONNECTION_STRING is not set");
}

async function main() {
  const client = new ServiceBusClient(connectionString);
  const receiver = client.createReceiver(queueName, {
    subQueueType: "deadLetter",
  });

  let total = 0;

  while (true) {
    const messages = await receiver.receiveMessages(10, {
      maxWaitTimeInMs: 3000,
    });

    if (messages.length === 0) break;

    for (const message of messages) {
      console.log("deleting dead-letter message:", {
        messageId: message.messageId,
        deadLetterReason: message.deadLetterReason,
        deadLetterErrorDescription: message.deadLetterErrorDescription,
        body: message.body,
      });

      await receiver.completeMessage(message);
      total += 1;
    }
  }

  await receiver.close();
  await client.close();

  console.log(`deleted ${total} dead-letter message(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});