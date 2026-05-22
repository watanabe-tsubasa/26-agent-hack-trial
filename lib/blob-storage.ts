import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";

function getBlobServiceClient(): BlobServiceClient {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
  return BlobServiceClient.fromConnectionString(connStr);
}

export function getBlobUrl(container: string, blobName: string): string {
  const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (!endpoint) throw new Error("AZURE_STORAGE_BLOB_ENDPOINT is not set");
  return `${endpoint.replace(/\/$/, "")}/${container}/${blobName}`;
}

export async function uploadFile(
  container: string,
  blobName: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(container);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

export async function generateBlobReadSasUrl(
  container: string,
  blobName: string,
  expiresInMinutes = 15
): Promise<string> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(container);
  const blobClient = containerClient.getBlobClient(blobName);
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  return blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn,
  });
}
