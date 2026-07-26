import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packPath = path.join(projectRoot, "packs", "rise-of-venegon-npcs");
const outputPath = await fs.mkdtemp(path.join(os.tmpdir(), "rise-of-venegon-pack-"));

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }
  return files;
}

try {
  await extractPack(packPath, outputPath, {
    folders: true,
    clean: true,
    log: false
  });

  const documents = await Promise.all((await walk(outputPath)).map(async (file) =>
    JSON.parse(await fs.readFile(file, "utf8"))
  ));
  const actors = documents.filter((document) => document._key?.startsWith("!actors!"));
  const folders = documents.filter((document) => document._key?.startsWith("!folders!"));
  const items = actors.reduce((count, actor) => count + (actor.items?.length ?? 0), 0);
  const errors = [];

  if (actors.length !== 60) errors.push(`Expected 60 packed actors, found ${actors.length}`);
  if (folders.length !== 22) errors.push(`Expected 22 packed folders, found ${folders.length}`);
  if (items !== 458) errors.push(`Expected 458 packed items, found ${items}`);

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Round-trip validation passed: ${actors.length} actors, ${folders.length} folders, ${items} items`);
  }
} finally {
  await fs.rm(outputPath, { recursive: true, force: true });
}
