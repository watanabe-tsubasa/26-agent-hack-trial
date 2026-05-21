import OpenAI from "openai";
import {
  generatedContentJsonSchema,
  generatedContentSchema,
} from "../lib/accident-report-schema";

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

const payload = {
  accidentInput: {
    summary:
      "ショッピングセンター1階共用通路で天板が落下した。床面に部材が散乱しており、通行規制を実施している。",
    facilityName: "サンプルショッピングセンター",
    location: "1階 共用通路",
    occurredAt: "2026-05-21T11:25:00+09:00",
    reporterName: "渡辺",
    injuryStatus: "現時点でけが人なし。確認中。",
    damageStatus: "天板の一部が落下。床面に部材散乱。",
  },
  imageObservation:
    "監視カメラ候補画像では、共用通路の床面に天板状の部材が落下している状況が確認される。周囲の通行者への接触有無は画像のみでは断定できない。",
  photoCandidates: [
    {
      id: "frame_ceiling_board_0001",
      cameraName: "ショッピングセンター1階 共用部天井監視カメラ",
      capturedAt: "2026-05-21T11:25:00Z",
    },
  ],
};

const response = await client.responses.create({
  model: deployment,
  instructions: [
    "あなたは施設管理会社の事故報告書作成支援AIです。",
    "必ず指定されたJSON Schemaに従って出力してください。",
    "事実と推測を混同しないでください。",
    "不明な情報は「確認中」「不明」「要確認」と記載してください。",
    "原因を断定せず、「可能性がある」「推測される」などの表現を使ってください。",
  ].join("\n"),
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify(payload, null, 2),
        },
      ],
    },
  ],
  text: {
    format: {
      type: "json_schema",
      name: "accident_report_content",
      strict: true,
      schema: generatedContentJsonSchema,
    },
  },
});

const outputText = response.output_text;
if (!outputText) throw new Error("response.output_text is empty");

const parsed = JSON.parse(outputText);
const result = generatedContentSchema.parse(parsed);

console.log("Structured Outputs OK");
console.log(JSON.stringify(result, null, 2));