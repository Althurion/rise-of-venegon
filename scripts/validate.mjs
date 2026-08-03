import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const generatedRoot = path.join(projectRoot, "source", "generated", "rise-of-venegon-npcs");
const actorRoot = path.join(generatedRoot, "actors");
const folderRoot = path.join(generatedRoot, "folders");
const modulePath = path.join(projectRoot, "module.json");
const sourcePath = path.join(projectRoot, "source", "npcs.json");
const artMapPath = path.join(projectRoot, "source", "art-map.json");

async function readJsonFiles(directory) {
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) =>
    JSON.parse(await fs.readFile(path.join(directory, name), "utf8"))
  ));
}

const moduleJson = JSON.parse(await fs.readFile(modulePath, "utf8"));
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const artMap = JSON.parse(await fs.readFile(artMapPath, "utf8"));
const sourceByPath = new Map(source.npcs.map((record) => [record.path, record]));
const actors = await readJsonFiles(actorRoot);
const folders = await readJsonFiles(folderRoot);
const report = JSON.parse(await fs.readFile(path.join(generatedRoot, "_build-report.json"), "utf8"));
const errors = [];
const warnings = [...report.warnings];
const ids = new Set();
const folderIds = new Set(folders.map((folder) => folder._id));
let itemCount = 0;
let activityCount = 0;
let attackCount = 0;
let saveCount = 0;
let healCount = 0;
let placeholderCount = 0;
let spellcasterCount = 0;
let wildcardTokenCount = 0;
let assignedArtCount = 0;

function moduleAssetPath(value) {
  const prefix = "modules/rise-of-venegon/";
  if (!value?.startsWith(prefix)) return null;
  return path.join(projectRoot, value.slice(prefix.length));
}

async function wildcardMatches(value) {
  const absolute = moduleAssetPath(value);
  if (!absolute || !absolute.endsWith("*.png")) return [];
  const directory = path.dirname(absolute);
  try {
    return (await fs.readdir(directory)).filter((name) => name.endsWith(".png"));
  } catch {
    return [];
  }
}

if (moduleJson.id !== "rise-of-venegon") errors.push("module.json id must be rise-of-venegon");
if (moduleJson.compatibility.minimum !== "14.365") errors.push("Foundry minimum compatibility must be 14.365");
if (actors.length !== source.npcs.length) {
  errors.push(`Expected ${source.npcs.length} actors from source, found ${actors.length}`);
}

for (const folder of folders) {
  if (!folder._id || folder._key !== `!folders!${folder._id}`) errors.push(`Invalid folder key for ${folder.name}`);
  if (folder.folder && !folderIds.has(folder.folder)) errors.push(`Missing parent folder for ${folder.name}`);
}

for (const actor of actors) {
  if (ids.has(actor._id)) errors.push(`Duplicate actor id ${actor._id}`);
  ids.add(actor._id);
  if (!folderIds.has(actor.folder)) errors.push(`${actor.name} has an unknown folder`);
  if (actor._key !== `!actors!${actor._id}`) errors.push(`${actor.name} has an invalid _key`);
  if (actor.type !== "npc") errors.push(`${actor.name} is not an npc Actor`);
  if (!actor.system?.attributes?.hp?.max) errors.push(`${actor.name} has no hit point maximum`);
  if (!Number.isFinite(actor.system?.attributes?.ac?.flat)) errors.push(`${actor.name} has no flat AC`);
  if (!Number.isFinite(actor.system?.details?.cr)) errors.push(`${actor.name} has an invalid CR`);
  if (actor.prototypeToken?.actorLink !== false) errors.push(`${actor.name} must use an unlinked prototype token`);
  if (actor.flags?.["rise-of-venegon"]?.placeholderArt) placeholderCount += 1;
  else assignedArtCount += 1;
  const sourceRecord = sourceByPath.get(actor.flags?.["rise-of-venegon"]?.sourcePath);
  if (!sourceRecord) errors.push(`${actor.name} has no matching source record`);

  const art = artMap[actor.flags?.["rise-of-venegon"]?.slug];
  if (art) {
    const actorImage = moduleAssetPath(actor.img);
    if (!actorImage) errors.push(`${actor.name} actor image is not module-relative`);
    else {
      try { await fs.access(actorImage); } catch { errors.push(`${actor.name} actor image does not exist`); }
    }

    if (art.randomImg === true) {
      wildcardTokenCount += 1;
      if (actor.prototypeToken.randomImg !== true) errors.push(`${actor.name} wildcard token is not enabled`);
      const matches = await wildcardMatches(actor.prototypeToken.texture.src);
      if (matches.length < 2) errors.push(`${actor.name} wildcard path resolves to fewer than two PNGs`);
    } else {
      if (actor.prototypeToken.randomImg !== false) errors.push(`${actor.name} unexpectedly enables wildcard tokens`);
      const tokenImage = moduleAssetPath(actor.prototypeToken.texture.src);
      if (!tokenImage) errors.push(`${actor.name} token image is not module-relative`);
      else {
        try { await fs.access(tokenImage); } catch { errors.push(`${actor.name} token image does not exist`); }
      }
    }
  }

  if (sourceRecord?.actualSpells === "Yes") {
    spellcasterCount += 1;
    const spellcasting = actor.items.find((item) => item.name === "Spellcasting");
    if (!spellcasting) errors.push(`${actor.name} is missing its Spellcasting feature`);
    else if (!/(?:Cantrips|1st level).*<br>|<br>.*(?:Cantrips|1st level)/i.test(spellcasting.system.description.value)) {
      errors.push(`${actor.name} Spellcasting feature is missing its spell list`);
    }
    if (!actor.system.attributes.spellcasting) errors.push(`${actor.name} has no spellcasting ability`);
    if (!actor.system.attributes.spell.level) errors.push(`${actor.name} has no spellcaster level`);
    if (!Object.keys(actor.system.spells ?? {}).length) errors.push(`${actor.name} has no spell slots`);
  }

  const itemIds = new Set();
  for (const item of actor.items) {
    itemCount += 1;
    if (itemIds.has(item._id)) errors.push(`${actor.name} has duplicate item id ${item._id}`);
    itemIds.add(item._id);
    if (item._key !== `!actors.items!${actor._id}.${item._id}`) {
      errors.push(`${actor.name}/${item.name} has an invalid embedded item key`);
    }
    const activities = Object.values(item.system?.activities ?? {});
    activityCount += activities.length;
    const description = item.system?.description?.value ?? "";
    const qualifier = item.flags?.["rise-of-venegon"]?.qualifier ?? "";
    const section = item.flags?.["rise-of-venegon"]?.section ?? "";
    const hasAttackText = /\bAttack:/i.test(description);
    const hasSaveText = /DC\s+\d+\s+(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i
      .test(description);
    const hasDamageRollText = /\d+\s+\([^)]+\)\s+[a-z]+\s+damage/i.test(description);
    const hasAttackActivity = activities.some((activity) => activity.type === "attack");
    const hasSaveActivity = activities.some((activity) => activity.type === "save");
    const hasDamageActivity = activities.some((activity) =>
      ["attack", "save", "damage"].includes(activity.type) && activity.damage?.parts?.length
    );

    if (hasAttackText && !hasAttackActivity) errors.push(`${actor.name}/${item.name} is missing its attack activity`);
    if (hasSaveText && !hasSaveActivity) errors.push(`${actor.name}/${item.name} is missing its save activity`);
    if (hasDamageRollText && !hasDamageActivity) errors.push(`${actor.name}/${item.name} is missing rollable damage`);
    const attackMatch = description.match(/(?:(Melee|Ranged|Melee or Ranged)\s+)?(?:Weapon|Spell) Attack:\s*\+(\d+)\s+to hit/i);
    if (attackMatch) {
      const attackActivities = activities.filter((activity) => activity.type === "attack");
      const expectedCount = attackMatch[1]?.toLowerCase() === "melee or ranged" ? 2 : 1;
      if (attackActivities.length !== expectedCount) {
        errors.push(`${actor.name}/${item.name} expected ${expectedCount} attack activities, found ${attackActivities.length}`);
      }
      for (const activity of attackActivities) {
        if (String(activity.attack?.bonus) !== attackMatch[2]) {
          errors.push(`${actor.name}/${item.name} attack bonus should be +${attackMatch[2]}`);
        }
      }
    }
    const saveMatch = description.match(/DC\s+(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
    if (saveMatch) {
      for (const activity of activities.filter((candidate) => candidate.type === "save")) {
        if (String(activity.save?.dc?.formula) !== saveMatch[1]) {
          errors.push(`${actor.name}/${item.name} save DC should be ${saveMatch[1]}`);
        }
      }
    }
    if (/^Recharge\b/i.test(qualifier)
      && !item.system.uses?.recovery?.some((recovery) => recovery.period === "recharge")) {
      errors.push(`${actor.name}/${item.name} is missing recharge recovery`);
    }
    if (/^\d+\/Day$/i.test(qualifier)
      && !item.system.uses?.recovery?.some((recovery) => recovery.period === "day")) {
      errors.push(`${actor.name}/${item.name} is missing daily recovery`);
    }
    if (section === "legendaryActions" && !activities.some((activity) =>
      activity.activation?.type === "legendary"
      && activity.consumption?.targets?.some((target) => target.target === "resources.legact.value")
    )) {
      errors.push(`${actor.name}/${item.name} does not consume legendary actions`);
    }

    for (const activity of activities) {
      if (activity.type === "attack") {
        attackCount += 1;
        if (!activity.attack?.bonus) errors.push(`${actor.name}/${item.name} has an attack without a bonus`);
      }
      if (activity.type === "save") {
        saveCount += 1;
        if (!activity.save?.dc?.formula) errors.push(`${actor.name}/${item.name} has a save without a DC`);
      }
      if (activity.type === "heal") healCount += 1;
    }
  }
}

if (!attackCount) errors.push("No attack activities were generated");
if (!saveCount) errors.push("No saving throw activities were generated");
if (!healCount) warnings.push("No healing activities were generated");

const ledgerIds = source.npcs.map((record) => record.ledgerId).filter(Boolean);
if (ledgerIds.length && ledgerIds.length !== source.npcs.length) {
  errors.push(`Only ${ledgerIds.length}/${source.npcs.length} source records have ledger IDs`);
}
if (new Set(ledgerIds).size !== ledgerIds.length) errors.push("Source ledger IDs are not unique");

console.log(JSON.stringify({
  actors: actors.length,
  folders: folders.length,
  items: itemCount,
  activities: activityCount,
  attacks: attackCount,
  saves: saveCount,
  heals: healCount,
  spellcasters: spellcasterCount,
  assignedArt: assignedArtCount,
  wildcardTokens: wildcardTokenCount,
  placeholderArt: placeholderCount,
  parserWarnings: warnings.length
}, null, 2));

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("Validation errors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Validation passed");
}
