import { CosmosClient, type Container } from "@azure/cosmos";

let cachedContainer: Container | null | undefined;

export function getCosmosContainer(): Container | null {
  if (cachedContainer !== undefined) return cachedContainer;

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  const databaseId = process.env.COSMOS_DATABASE ?? "agent-hack-trial";
  const containerId = process.env.COSMOS_CONTAINER ?? "agent_events";

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
    console.warn("Cosmos init failed; agent event log disabled.", err);
    cachedContainer = null;
    return null;
  }
}

export function isCosmosEnabled(): boolean {
  return getCosmosContainer() !== null;
}
