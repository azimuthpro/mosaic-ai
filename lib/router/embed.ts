import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");

const GOOGLE_DOC_OPTIONS = {
  google: {
    outputDimensionality: 768,
    taskType: "RETRIEVAL_DOCUMENT" as const,
  },
};

const GOOGLE_QUERY_OPTIONS = {
  google: {
    outputDimensionality: 768,
    taskType: "RETRIEVAL_QUERY" as const,
  },
};

/** Embed a single text for document indexing */
export async function embedDocument(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: GOOGLE_DOC_OPTIONS,
  });
  return embedding;
}

/** Embed a user query for search */
export async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: GOOGLE_QUERY_OPTIONS,
  });
  return embedding;
}

/** Embed multiple documents (for batch indexing) */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
    providerOptions: GOOGLE_DOC_OPTIONS,
  });
  return embeddings;
}

/** Format embedding array to pgvector string format */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
