import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const positional = args.filter((argument) => !argument.startsWith("--"));
const readOption = (name, fallback = "") => {
  const prefix = `--${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};
const append = args.includes("--append");
const supplement = readOption("supplement", "Beneath the Living Mist");
const pathPrefix = readOption("path-prefix");
const statblockRoot = path.resolve(positional[0] ?? path.join(projectRoot, "..", "source_statblocks", "VTT_Statblocks"));
const indexPath = path.resolve(positional[1] ?? path.join(projectRoot, "..", "upload", "NPC_Index(1).csv"));
const outputPath = path.join(projectRoot, "source", "npcs.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".txt") && entry.name !== "README.txt") files.push(entryPath);
  }
  return files;
}

const indexRows = parseCsv(await fs.readFile(indexPath, "utf8"));
const indexByPath = new Map(indexRows.map((row) => {
  const normalized = row["Text File"].replaceAll("\\", "/").replace(/^VTT_Statblocks\//, "");
  return [normalized, row];
}));

const files = (await walk(statblockRoot)).sort();
const npcs = [];

for (const file of files) {
  const relativePath = path.relative(statblockRoot, file).split(path.sep).join("/");
  const metadata = indexByPath.get(relativePath);
  if (!metadata) throw new Error(`No NPC index row found for ${relativePath}`);
  npcs.push({
    path: [pathPrefix, relativePath].filter(Boolean).join("/"),
    chapter: metadata.Chapter,
    party: metadata.Party,
    section: metadata.Section,
    name: metadata.NPC,
    cr: metadata.CR,
    role: metadata.Role,
    supplement,
    text: (await fs.readFile(file, "utf8")).replaceAll("\r\n", "\n").trim()
  });
}

if (npcs.length !== indexRows.length) {
  throw new Error(`Imported ${npcs.length} statblocks but the index contains ${indexRows.length} rows`);
}

let output = {
  supplement: "Beneath the Living Mist",
  rules: "2014",
  npcs
};

if (append) {
  const existing = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const importedPaths = new Set(npcs.map((npc) => npc.path));
  output = {
    ...existing,
    npcs: [
      ...existing.npcs.filter((npc) => !importedPaths.has(npc.path)),
      ...npcs
    ]
  };
}

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`${append ? "Merged" : "Imported"} ${npcs.length} statblocks; ${output.npcs.length} total in ${path.relative(projectRoot, outputPath)}`);
