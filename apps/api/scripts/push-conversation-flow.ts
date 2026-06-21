import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// One JSON file is the source of truth for the flow graph; this script just
// substitutes env placeholders and PUTs it to Retell instead of clicking the dashboard.
const FLOW_PATH = join(import.meta.dirname, "..", "conversation-flow.json");
const ID_CACHE_PATH = join(import.meta.dirname, "..", ".retell-flow-id");

function substituteEnvPlaceholders(raw: string): string {
  return raw.replace(/\{\{env:([A-Z_]+)\}\}/g, (match, name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing env var ${name} referenced in conversation-flow.json`);
    return value;
  });
}

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("RETELL_API_KEY missing in apps/api/.env");

  const raw = readFileSync(FLOW_PATH, "utf-8");
  const body = substituteEnvPlaceholders(raw);

  const existingId = existsSync(ID_CACHE_PATH) ? readFileSync(ID_CACHE_PATH, "utf-8").trim() : null;
  const url = existingId
    ? `https://api.retellai.com/update-conversation-flow/${existingId}`
    : "https://api.retellai.com/create-conversation-flow";
  const method = existingId ? "PATCH" : "POST";

  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body,
  });

  const payload = await response.json();

  if (!response.ok) {
    console.error(`Retell rejected the flow: HTTP ${response.status}`);
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const flowId = payload.conversation_flow_id;
  if (!existingId && flowId) writeFileSync(ID_CACHE_PATH, flowId);

  console.log(existingId ? "Updated" : "Created", "conversation flow:", flowId, "version:", payload.version);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
