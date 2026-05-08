import { google } from "@ai-sdk/google";
import { embed, embedMany as aiEmbedMany } from "ai";

export const EMBED_MODEL_ID = "gemini-embedding-001";
export const EMBED_DIMENSIONS = 1536;

// Gemini accepts up to 100 inputs per embed call; we batch above that.
const BATCH_LIMIT = 100;

function model() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }
  return google.textEmbedding(EMBED_MODEL_ID);
}

function googleProviderOptions(taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT") {
  return {
    google: {
      outputDimensionality: EMBED_DIMENSIONS,
      taskType,
    },
  };
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: model(),
    value: text,
    providerOptions: googleProviderOptions("RETRIEVAL_QUERY"),
  });
  return embedding;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const slice = texts.slice(i, i + BATCH_LIMIT);
    const { embeddings } = await aiEmbedMany({
      model: model(),
      values: slice,
      providerOptions: googleProviderOptions("RETRIEVAL_DOCUMENT"),
    });
    out.push(...embeddings);
  }
  return out;
}
