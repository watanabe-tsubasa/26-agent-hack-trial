import { CosmosClient, type Container } from "@azure/cosmos";

let cachedContainer: Container | null | undefined;

export function getReportRagContainer(): Container | null {
  if (cachedContainer !== undefined) return cachedContainer;

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  const databaseId = process.env.COSMOS_DATABASE ?? "agent-hack-trial";
  const containerId = process.env.COSMOS_RAG_CONTAINER ?? "report_search_documents";

  try {
    let client: CosmosClient;
    if (connectionString) {
      client = new CosmosClient(connectionString);
    } else if (endpoint && key) {
      client = new CosmosClient({ endpoint, key });
    } else {
      cachedContainer = null;
      return null;
    }
    cachedContainer = client.database(databaseId).container(containerId);
    return cachedContainer;
  } catch (err) {
    console.warn("Cosmos RAG init failed; report rag disabled.", err);
    cachedContainer = null;
    return null;
  }
}

export function isReportRagEnabled(): boolean {
  return getReportRagContainer() !== null;
}
