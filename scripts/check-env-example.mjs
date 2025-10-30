#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? "1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplePath = resolve(__dirname, "../.env.example");

let serverSchema;
let clientSchema;

try {
  const schemaModule = await import("../env.mjs");
  ({ serverSchema, clientSchema } = schemaModule);
} catch (error) {
  console.error("❌ Could not load the environment schema (env.mjs).", error);
  process.exit(1);
}

async function readEnvExample(path) {
  try {
    const contents = await readFile(path, "utf8");
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.split("=", 1)[0]);
  } catch (error) {
    console.error(`❌ Unable to read .env.example at ${path}.`);
    console.error(error.message);
    process.exit(1);
  }
}

const schemaKeys = [
  ...new Set([
    ...Object.keys(serverSchema.shape ?? {}),
    ...Object.keys(clientSchema.shape ?? {}),
  ]),
];

const exampleKeys = new Set(await readEnvExample(examplePath));

const missing = schemaKeys.filter((key) => !exampleKeys.has(key));
const extras = Array.from(exampleKeys).filter((key) => !schemaKeys.includes(key));

if (missing.length > 0 || extras.length > 0) {
  if (missing.length > 0) {
    console.error("❌ .env.example is missing the following keys defined in env.mjs:");
    for (const key of missing) {
      console.error(`   • ${key}`);
    }
  }

  if (extras.length > 0) {
    console.error("⚠️  .env.example contains keys not present in env.mjs:");
    for (const key of extras) {
      console.error(`   • ${key}`);
    }
  }

  process.exit(1);
}

console.log("✅ .env.example matches the keys defined in env.mjs.");
