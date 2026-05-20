/**
 * Thin wrappers over Google Sheets / Drive REST APIs.
 *
 * We intentionally avoid pulling in `googleapis` (large dep) — the surface we
 * need is small and `fetch` is fine. All calls take a bearer access token; the
 * caller is responsible for resolving/refreshing it via resolveGoogleToken.
 */

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export type CellValue = string | number | boolean | null;
export type Row = CellValue[];

async function sheetsFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${SHEETS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Sheets API ${init.method ?? "GET"} ${path} → ${response.status}: ${body}`,
    );
  }
  return response.json();
}

export interface CreatedSpreadsheet {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetIds: Record<string, number>; // tabTitle → sheetId
}

export interface SheetTabSpec {
  title: string;
  /** Header row written into row 1. */
  headers: string[];
  /** Number of leading columns to hide (e.g. our `__match_key` / `__event_id`). */
  hiddenLeadingColumns?: number;
}

/**
 * Creates a new spreadsheet with the given tabs and header rows. The user's
 * Google account becomes the owner (because we use their OAuth token).
 */
export async function createSpreadsheet(
  token: string,
  title: string,
  tabs: SheetTabSpec[],
): Promise<CreatedSpreadsheet> {
  const requestBody = {
    properties: { title },
    sheets: tabs.map((tab, i) => ({
      properties: {
        sheetId: i + 1,
        title: tab.title,
        gridProperties: {
          rowCount: 1000,
          columnCount: Math.max(tab.headers.length, 10),
        },
      },
    })),
  };

  const created = (await sheetsFetch(token, "", {
    method: "POST",
    body: JSON.stringify(requestBody),
  })) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    sheets: { properties: { sheetId: number; title: string } }[];
  };

  const sheetIds: Record<string, number> = {};
  for (const sheet of created.sheets) {
    sheetIds[sheet.properties.title] = sheet.properties.sheetId;
  }

  // Write header rows.
  const data = tabs.map((tab) => ({
    range: `${tab.title}!A1`,
    majorDimension: "ROWS",
    values: [tab.headers],
  }));
  await sheetsFetch(token, `/${created.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data,
    }),
  });

  // Apply hidden columns + header formatting per tab.
  const formattingRequests: unknown[] = [];
  for (const tab of tabs) {
    const sheetId = sheetIds[tab.title];
    if (sheetId === undefined) continue;

    if (tab.hiddenLeadingColumns && tab.hiddenLeadingColumns > 0) {
      formattingRequests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: tab.hiddenLeadingColumns,
          },
          properties: { hiddenByUser: true },
          fields: "hiddenByUser",
        },
      });
    }

    formattingRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 },
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)",
      },
    });
  }

  if (formattingRequests.length > 0) {
    await sheetsFetch(token, `/${created.spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: formattingRequests }),
    });
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    sheetIds,
  };
}

/**
 * Reads a range from the spreadsheet and returns the raw 2D array of values.
 * Missing trailing cells in a row come back as undefined; we normalize to "".
 */
export async function getValues(
  token: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const data = (await sheetsFetch(
    token,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
  )) as { values?: (string | number | boolean)[][] };

  return (data.values ?? []).map((row) =>
    row.map((cell) => String(cell ?? "")),
  );
}

/**
 * Overwrites the given range (no auto-extend). Use for updating specific rows.
 */
export async function updateValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: Row[],
): Promise<void> {
  await sheetsFetch(
    token,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ values, majorDimension: "ROWS" }),
    },
  );
}

/**
 * Appends rows to the end of the given tab.
 */
export async function appendValues(
  token: string,
  spreadsheetId: string,
  tabTitle: string,
  values: Row[],
): Promise<void> {
  if (values.length === 0) return;
  await sheetsFetch(
    token,
    `/${spreadsheetId}/values/${encodeURIComponent(tabTitle)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values, majorDimension: "ROWS" }),
    },
  );
}

/**
 * Deletes specific rows (1-indexed inclusive) from a tab. Pass an unsorted list;
 * we batch as deleteDimension requests, processed top-down so indices stay valid.
 */
export async function deleteRows(
  token: string,
  spreadsheetId: string,
  sheetId: number,
  rowNumbers: number[],
): Promise<void> {
  if (rowNumbers.length === 0) return;
  // Sort descending so earlier deletes don't shift later row indices.
  const sorted = [...rowNumbers].sort((a, b) => b - a);
  const requests = sorted.map((rowNumber) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: rowNumber - 1, // API is 0-indexed
        endIndex: rowNumber,
      },
    },
  }));
  await sheetsFetch(token, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

/**
 * Fetches sheet metadata — used to discover sheetIds when we only saved the
 * spreadsheetId on the tile.
 */
export async function getSheetIds(
  token: string,
  spreadsheetId: string,
): Promise<Record<string, number>> {
  const data = (await sheetsFetch(
    token,
    `/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
  )) as {
    sheets: { properties: { sheetId: number; title: string } }[];
  };
  const map: Record<string, number> = {};
  for (const s of data.sheets) {
    map[s.properties.title] = s.properties.sheetId;
  }
  return map;
}
