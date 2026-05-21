import { google } from "@ai-sdk/google";

export const proModel = google("gemini-pro-latest");

export const flashModel = google("gemini-flash-latest");

export const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");
