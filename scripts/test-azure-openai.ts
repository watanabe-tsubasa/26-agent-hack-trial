import OpenAI from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set");
if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not set");
if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT_NAME is not set");

const client = new OpenAI({
  apiKey,
  baseURL: `${endpoint.replace(/\/$/, "")}/openai/v1/`,
});

const response = await client.responses.create({
  model: deployment,
  input: "日本語で一言だけ、疎通確認OKと返してください。",
});

console.log(response.output_text);