import { getAzureOpenAIClient } from "../azure-openai";

export async function embedText(text: string): Promise<number[]> {
  const model = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME;
  if (!model) throw new Error("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME is not set");

  const client = getAzureOpenAIClient();
  const res = await client.embeddings.create({
    model,
    input: text,
  });
  const embedding = res.data[0]?.embedding;
  if (!embedding) throw new Error("embedding response is empty");
  return embedding;
}
