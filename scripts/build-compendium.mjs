import { promises as fs } from "node:fs";
import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = path.join(projectRoot, "source", "generated", "rise-of-venegon-npcs");
const destination = path.join(projectRoot, "packs", "rise-of-venegon-npcs");

await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(path.dirname(destination), { recursive: true });

await compilePack(source, destination, {
  recursive: true,
  log: true,
  transformEntry(entry) {
    if (entry.actorCount !== undefined && entry._key === undefined) return false;
  }
});

console.log(`Compiled LevelDB pack at ${path.relative(projectRoot, destination)}`);
