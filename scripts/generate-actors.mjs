import { promises as fs } from "node:fs";
import path from "node:path";
import { makeFolder, parseActor, slugify } from "./lib.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(projectRoot, "source", "npcs.json");
const artMapPath = path.join(projectRoot, "source", "art-map.json");
const outputRoot = path.join(projectRoot, "source", "generated", "rise-of-venegon-npcs");
const actorOutput = path.join(outputRoot, "actors");
const folderOutput = path.join(outputRoot, "folders");

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const artMap = JSON.parse(await fs.readFile(artMapPath, "utf8"));

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(actorOutput, { recursive: true });
await fs.mkdir(folderOutput, { recursive: true });

const chapterLabels = {
  "01_Dark_Elves": "Dark Elves",
  "02_Grey_Dwarves": "Grey Dwarves",
  "03_Deepwatch_Dwarves": "Deepwatch Dwarves",
  "04_Adventuring_Parties": "Adventuring Parties"
};

const folders = [];
const topFolders = new Map();
const childFolders = new Map();

for (const [index, label] of Object.values(chapterLabels).entries()) {
  const folder = makeFolder(label, null, index * 100000);
  topFolders.set(label, folder.id);
  folders.push(folder.document);
}

const actors = [];
const warningLog = [];

for (const record of source.npcs) {
  const chapterLabel = chapterLabels[record.chapter] ?? record.chapter;
  const parentId = topFolders.get(chapterLabel);
  const childName = record.chapter === "04_Adventuring_Parties"
    ? record.section
    : record.section;
  const folderKey = `${parentId}:${childName}`;
  if (!childFolders.has(folderKey)) {
    const folder = makeFolder(childName, parentId, childFolders.size * 100000);
    childFolders.set(folderKey, folder.id);
    folders.push(folder.document);
  }

  const result = parseActor({
    ...record,
    supplement: source.supplement,
    chapterLabel
  }, childFolders.get(folderKey), artMap);
  actors.push(result.actor);
  for (const warning of result.warnings) warningLog.push(`${result.actor.name}: ${warning}`);
}

for (const folder of folders) {
  const file = path.join(folderOutput, `${slugify(folder.name)}-${folder._id}.json`);
  await fs.writeFile(file, `${JSON.stringify(folder, null, 2)}\n`);
}

for (const actor of actors) {
  const file = path.join(actorOutput, `${slugify(actor.name)}-${actor._id}.json`);
  await fs.writeFile(file, `${JSON.stringify(actor, null, 2)}\n`);
}

await fs.writeFile(path.join(outputRoot, "_build-report.json"), `${JSON.stringify({
  actorCount: actors.length,
  folderCount: folders.length,
  itemCount: actors.reduce((count, actor) => count + actor.items.length, 0),
  activityCount: actors.reduce((count, actor) =>
    count + actor.items.reduce((itemCount, item) => itemCount + Object.keys(item.system.activities).length, 0), 0),
  warnings: warningLog
}, null, 2)}\n`);

console.log(`Generated ${actors.length} actors in ${folders.length} folders`);
if (warningLog.length) {
  console.warn(`${warningLog.length} parser warnings were recorded in source/generated/rise-of-venegon-npcs/_build-report.json`);
}
