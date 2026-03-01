import { google } from "@ai-sdk/google";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import type {
  CatalogDiffPayload,
  CatalogEntry,
  CatalogField,
  CatalogSchema,
  Database,
  Json,
} from "@/types/database";

const model = google("gemini-flash-latest");

const MAX_CATALOG_ENTRIES = 500;
const MAX_ENTRIES_IN_AI_CONTEXT = 200;
const MAX_EVENTS_PER_ENTRY = 100;

interface AIEntity {
  match_key: string;
  data: Record<string, unknown>;
  status: "new" | "update" | "existing";
  matched_entry_id?: string;
  changed_fields?: string[];
}

interface AIEvent {
  entity_match_key: string;
  event_type: string;
  title: string;
  description?: string;
  event_date?: string;
  source_url?: string;
}

interface AIExtractionResult {
  entities: AIEntity[];
  events: AIEvent[];
}

interface SchemaDetectionResult {
  entity_type: string;
  fields: CatalogField[];
}

export interface CatalogUpdateResult {
  diff: CatalogDiffPayload;
  jobResultContent: Json;
}

/**
 * Main catalog update function. Called instead of analyzeContent for catalog tiles.
 */
export async function executeCatalogUpdate(
  tileId: string,
  fetchedContent: string[],
  systemPrompt: string | null,
  adminClient: SupabaseClient<Database>,
  jobId: string,
): Promise<CatalogUpdateResult> {
  // 1. Load existing state
  const [schema, existingEntries] = await Promise.all([
    loadSchema(tileId, adminClient),
    loadEntries(tileId, adminClient),
  ]);

  const combinedContent = fetchedContent.join("\n\n---\n\n");

  // 2. Schema detection (if no schema exists yet)
  let currentSchema = schema;
  if (!currentSchema) {
    const detected = await detectSchema(combinedContent, systemPrompt);
    currentSchema = await upsertSchema(tileId, detected, adminClient);
  }

  // 3. Entity & Event extraction
  const extraction = await extractEntitiesAndEvents(
    combinedContent,
    systemPrompt,
    currentSchema,
    existingEntries,
  );

  // 4. Merge/dedup
  const entryMap = new Map(existingEntries.map((e) => [e.match_key, e]));

  const addedEntries: CatalogDiffPayload["added_entries"] = [];
  const updatedEntries: CatalogDiffPayload["updated_entries"] = [];

  for (const entity of extraction.entities) {
    const normalizedKey = normalizeMatchKey(entity.match_key);
    const existing = entryMap.get(normalizedKey);

    if (entity.status === "new" && !existing) {
      // Check entry limit
      if (entryMap.size >= MAX_CATALOG_ENTRIES) continue;

      const { data: inserted } = await adminClient
        .from("catalog_entries")
        .insert({
          tile_id: tileId,
          match_key: normalizedKey,
          data: entity.data as Json,
          source_job_id: jobId,
          last_updated_job_id: jobId,
        } as never)
        .select("id")
        .single();

      if (inserted) {
        const entry = inserted as { id: string };
        entryMap.set(normalizedKey, {
          id: entry.id,
          tile_id: tileId,
          match_key: normalizedKey,
          data: entity.data as Json,
          source_job_id: jobId,
          last_updated_job_id: jobId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        addedEntries.push({
          id: entry.id,
          match_key: normalizedKey,
          data: entity.data as Json,
        });
      }
    } else if (entity.status === "update" && existing) {
      // Merge fields into existing data
      const mergedData = { ...toRecord(existing.data), ...entity.data };

      await adminClient
        .from("catalog_entries")
        .update({
          data: mergedData as Json,
          last_updated_job_id: jobId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", existing.id);

      updatedEntries.push({
        id: existing.id,
        changed_fields: entity.changed_fields || Object.keys(entity.data),
      });
    }
    // status === "existing" → no changes to entity data
  }

  // 5. Insert events (with dedup)
  const newEvents: CatalogDiffPayload["new_events"] = [];

  for (const event of extraction.events) {
    const normalizedKey = normalizeMatchKey(event.entity_match_key);
    let entry = entryMap.get(normalizedKey);
    if (!entry) {
      // Auto-create entity for orphan event
      if (entryMap.size >= MAX_CATALOG_ENTRIES) continue;

      const { data: inserted } = await adminClient
        .from("catalog_entries")
        .insert({
          tile_id: tileId,
          match_key: normalizedKey,
          data: { name: event.entity_match_key } as Json,
          source_job_id: jobId,
          last_updated_job_id: jobId,
        } as never)
        .select("id")
        .single();

      if (!inserted) continue;

      const newEntry = {
        id: (inserted as { id: string }).id,
        tile_id: tileId,
        match_key: normalizedKey,
        data: { name: event.entity_match_key } as Json,
        source_job_id: jobId,
        last_updated_job_id: jobId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      entryMap.set(normalizedKey, newEntry);
      addedEntries.push({
        id: newEntry.id,
        match_key: normalizedKey,
        data: newEntry.data,
      });
      entry = newEntry;
    }

    // Check event limit per entry
    const { count } = await adminClient
      .from("catalog_entry_events")
      .select("id", { count: "exact", head: true })
      .eq("entry_id", entry.id);

    if ((count ?? 0) >= MAX_EVENTS_PER_ENTRY) continue;

    // Dedup: check for existing event with same title + entry_id
    const { data: existingEvent } = await adminClient
      .from("catalog_entry_events")
      .select("id")
      .eq("entry_id", entry.id)
      .eq("title", event.title)
      .limit(1)
      .maybeSingle();

    if (existingEvent) continue;

    await adminClient.from("catalog_entry_events").insert({
      entry_id: entry.id,
      tile_id: tileId,
      job_id: jobId,
      event_type: event.event_type,
      title: event.title,
      description: event.description || "",
      event_date: event.event_date || null,
      source_url: event.source_url || null,
    } as never);

    newEvents.push({
      entry_id: entry.id,
      entry_name: entryDisplayName(entry.data, entry.match_key),
      event_type: event.event_type,
      title: event.title,
    });
  }

  // 6. Build diff
  const totalEntries = entryMap.size;
  const summary = buildDiffSummary(
    addedEntries,
    updatedEntries,
    newEvents,
    totalEntries,
  );

  const diff: CatalogDiffPayload = {
    added_entries: addedEntries,
    updated_entries: updatedEntries,
    new_events: newEvents,
    summary,
    total_entries: totalEntries,
  };

  // Save diff record
  await adminClient.from("catalog_diffs").insert({
    tile_id: tileId,
    job_id: jobId,
    added_entries: addedEntries as unknown as Json,
    updated_entries: updatedEntries as unknown as Json,
    new_events: newEvents as unknown as Json,
    summary,
  } as never);

  // 7. Job result content
  const jobResultContent: Json = {
    type: "catalog_diff",
    ...diff,
  };

  return { diff, jobResultContent };
}

// --- Helpers ---

/** Safely coerce a Json-typed `data` field to a plain object. */
function toRecord(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null
    ? (data as Record<string, unknown>)
    : {};
}

/** Parse a JSON response that may be wrapped in markdown code fences. */
function parseAIJson<T>(text: string, fallback: T): T {
  try {
    const cleaned = text
      .replace(/```\w*\n?/g, "")
      .replace(/```$/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/** Get a human-readable display name from a catalog entry. */
function entryDisplayName(data: unknown, matchKey: string): string {
  const record = toRecord(data);
  return (record.name as string) || matchKey;
}

function normalizeMatchKey(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, " ");
}

async function loadSchema(
  tileId: string,
  adminClient: SupabaseClient<Database>,
): Promise<CatalogSchema | null> {
  const { data } = await adminClient
    .from("catalog_schemas")
    .select("*")
    .eq("tile_id", tileId)
    .maybeSingle();

  return data as CatalogSchema | null;
}

async function loadEntries(
  tileId: string,
  adminClient: SupabaseClient<Database>,
): Promise<CatalogEntry[]> {
  const { data } = await adminClient
    .from("catalog_entries")
    .select("*")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: true })
    .limit(MAX_CATALOG_ENTRIES);

  return (data || []) as CatalogEntry[];
}

async function detectSchema(
  content: string,
  systemPrompt: string | null,
): Promise<SchemaDetectionResult> {
  const prompt = `You are analyzing source data to detect what type of entities it contains.

${systemPrompt ? `User instructions: ${systemPrompt}\n` : ""}
Analyze the following data and determine:
1. What type of entity is being described (e.g., "company", "person", "product", "organization")
2. What fields/attributes each entity has

Respond with ONLY a valid JSON object in this exact format:
{
  "entity_type": "company",
  "fields": [
    {"name": "name", "type": "string", "description": "Company name", "is_key": true},
    {"name": "industry", "type": "string", "description": "Industry sector"},
    {"name": "website", "type": "url", "description": "Company website"}
  ]
}

Field types must be one of: "string", "number", "boolean", "date", "url".
Mark the primary identifying field with "is_key": true.

Data to analyze:
${content.substring(0, 8000)}`;

  const { text } = await generateText({ model, prompt });

  return parseAIJson<SchemaDetectionResult>(text, {
    entity_type: "entity",
    fields: [
      {
        name: "name",
        type: "string",
        description: "Entity name",
        is_key: true,
      },
    ],
  });
}

async function upsertSchema(
  tileId: string,
  detected: SchemaDetectionResult,
  adminClient: SupabaseClient<Database>,
): Promise<CatalogSchema> {
  const { data } = await adminClient
    .from("catalog_schemas")
    .upsert(
      {
        tile_id: tileId,
        entity_type: detected.entity_type,
        fields: detected.fields as unknown as Json,
        version: 1,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "tile_id" },
    )
    .select()
    .single();

  return data as unknown as CatalogSchema;
}

async function extractEntitiesAndEvents(
  content: string,
  systemPrompt: string | null,
  schema: CatalogSchema,
  existingEntries: CatalogEntry[],
): Promise<AIExtractionResult> {
  const fields = schema.fields as unknown as CatalogField[];
  const fieldDescriptions = fields
    .map(
      (f) =>
        `- ${f.name} (${f.type}): ${f.description}${f.is_key ? " [KEY]" : ""}`,
    )
    .join("\n");

  // Build condensed index of existing entries
  const entryIndex = existingEntries
    .slice(0, MAX_ENTRIES_IN_AI_CONTEXT)
    .map((e) => {
      const data = toRecord(e.data);
      const keyFields: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.is_key && data[f.name] !== undefined) {
          keyFields[f.name] = data[f.name];
        }
      }
      return { id: e.id, match_key: e.match_key, ...keyFields };
    });

  const prompt = `You are extracting structured entities and events from source data for a ${schema.entity_type} catalog.

${systemPrompt ? `User instructions: ${systemPrompt}\n` : ""}
Entity schema (fields to extract):
${fieldDescriptions}

${
  entryIndex.length > 0
    ? `Existing entities in the catalog (${entryIndex.length} entries):
${JSON.stringify(entryIndex, null, 1)}`
    : "This is an empty catalog — all entities will be new."
}

Instructions:
- Extract all ${schema.entity_type} entities mentioned in the source data
- For each entity, set match_key to a lowercase normalized version of the key field (e.g. company name)
- Set status to "new" if the entity doesn't exist in the catalog
- Set status to "update" if it exists but has changed data (include matched_entry_id and changed_fields)
- Set status to "existing" if it exists and has no changes
- Also extract any events/news about entities (funding, hiring, product launches, expansions, etc.)
- NEVER invent entities or events — only extract what's explicitly in the source data

Respond with ONLY a valid JSON object:
{
  "entities": [
    {
      "match_key": "acme corp",
      "data": {"name": "Acme Corp", "industry": "SaaS"},
      "status": "new"
    }
  ],
  "events": [
    {
      "entity_match_key": "acme corp",
      "event_type": "funding",
      "title": "Raised $50M Series B",
      "description": "Acme Corp announced a $50M Series B round...",
      "event_date": "2026-03-01",
      "source_url": "https://example.com/article"
    }
  ]
}

Event types: "funding", "hiring", "product", "expansion", "partnership", "acquisition", "news", "other"

Source data:
${content.substring(0, 50000)}`;

  const { text } = await generateText({ model, prompt });

  return parseAIJson<AIExtractionResult>(text, { entities: [], events: [] });
}

function buildDiffSummary(
  added: CatalogDiffPayload["added_entries"],
  updated: CatalogDiffPayload["updated_entries"],
  events: CatalogDiffPayload["new_events"],
  totalEntries: number,
): string {
  const parts: string[] = [];

  const counts: string[] = [];
  if (added.length > 0) counts.push(`+${added.length} new entities`);
  if (updated.length > 0) counts.push(`~${updated.length} updated`);
  if (events.length > 0) counts.push(`${events.length} new events`);

  if (counts.length === 0) {
    return `Catalog unchanged (${totalEntries} total entities)`;
  }

  parts.push(`Catalog updated: ${counts.join(", ")} (${totalEntries} total)`);

  if (added.length > 0) {
    const names = added
      .slice(0, 5)
      .map((e) => entryDisplayName(e.data, e.match_key));
    parts.push(
      `New: ${names.join(", ")}${added.length > 5 ? ` (+${added.length - 5} more)` : ""}`,
    );
  }

  if (updated.length > 0) {
    const updates = updated.slice(0, 3).map((e) => {
      const fields = e.changed_fields.join(", ");
      return `${e.id.substring(0, 8)}… (${fields})`;
    });
    parts.push(`Updated: ${updates.join("; ")}`);
  }

  if (events.length > 0) {
    parts.push("Recent events:");
    for (const event of events.slice(0, 5)) {
      parts.push(`• ${event.entry_name}: ${event.title} (${event.event_type})`);
    }
  }

  return parts.join("\n\n");
}
