import { embed, embedMany } from "ai";

import { embeddingModel } from "@/lib/ai/models";

/** Must match the `vector(768)` column that stores these embeddings. */
const EMBEDDING_DIMENSIONS = 768;

// Provider options are forwarded verbatim to Google by the AI Gateway.
const GOOGLE_DOC_OPTIONS = {
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType: "RETRIEVAL_DOCUMENT",
  },
};

const GOOGLE_QUERY_OPTIONS = {
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType: "RETRIEVAL_QUERY",
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
