import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packPath = path.join(projectRoot, "packs", "rise-of-venegon-npcs");
const sourcePath = path.join(projectRoot, "source", "npcs.json");
const reportPath = path.join(projectRoot, "source", "generated", "rise-of-venegon-npcs", "_build-report.json");
const outputPath = await fs.mkdtemp(path.join(os.tmpdir(), "rise-of-venegon-pack-"));
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const report = JSON.parse(await fs.readFile(reportPath, "utf8"));

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

  if (actors.length !== source.npcs.length) {
    errors.push(`Expected ${source.npcs.length} packed actors, found ${actors.length}`);
  }
  if (folders.length !== report.folderCount) {
    errors.push(`Expected ${report.folderCount} packed folders, found ${folders.length}`);
  }
  if (items !== report.itemCount) {
    errors.push(`Expected ${report.itemCount} packed items, found ${items}`);
  }

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Round-trip validation passed: ${actors.length} actors, ${folders.length} folders, ${items} items`);
  }
} finally {
  await fs.rm(outputPath, { recursive: true, force: true });
}
