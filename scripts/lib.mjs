import crypto from "node:crypto";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_NAMES = {
  Strength: "str",
  Dexterity: "dex",
  Constitution: "con",
  Intelligence: "int",
  Wisdom: "wis",
  Charisma: "cha"
};

export const SKILLS = {
  Acrobatics: ["acr", "dex"],
  "Animal Handling": ["ani", "wis"],
  Arcana: ["arc", "int"],
  Athletics: ["ath", "str"],
  Deception: ["dec", "cha"],
  History: ["his", "int"],
  Insight: ["ins", "wis"],
  Intimidation: ["itm", "cha"],
  Investigation: ["inv", "int"],
  Medicine: ["med", "wis"],
  Nature: ["nat", "int"],
  Perception: ["prc", "wis"],
  Performance: ["prf", "cha"],
  Persuasion: ["per", "cha"],
  Religion: ["rel", "int"],
  "Sleight of Hand": ["slt", "dex"],
  Stealth: ["ste", "dex"],
  Survival: ["sur", "wis"]
};

const DAMAGE_TYPES = new Set([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder"
]);

const CONDITIONS = new Set([
  "blinded", "charmed", "deafened", "diseased", "exhaustion", "frightened",
  "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
  "poisoned", "prone", "restrained", "stunned", "unconscious"
]);

const SIZE_KEYS = {
  Tiny: "tiny",
  Small: "sm",
  Medium: "med",
  Large: "lg",
  Huge: "huge",
  Gargantuan: "grg"
};

const TOKEN_SIZES = {
  tiny: 0.5,
  sm: 1,
  med: 1,
  lg: 2,
  huge: 3,
  grg: 4
};

const SECTION_ACTIVATION = {
  actions: "action",
  bonusActions: "bonus",
  reactions: "reaction",
  legendaryActions: "legendary"
};

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replaceAll(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

export function stableId(seed) {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

export function parseCr(value) {
  const normalized = String(value).trim();
  if (normalized.includes("/")) {
    const [numerator, denominator] = normalized.split("/").map(Number);
    return numerator / denominator;
  }
  return Number(normalized);
}

export function proficiencyBonus(cr) {
  if (cr < 5) return 2;
  return 2 + Math.floor((cr - 1) / 4);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function signed(value) {
  if (!value) return "";
  return value > 0 ? String(value) : `- ${Math.abs(value)}`;
}

function parseFormula(formula, types) {
  const normalized = formula.replaceAll(/\s+/g, "");
  const dice = normalized.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i);
  if (dice) {
    const bonus = dice[3] ? `${dice[3] === "+" ? "" : "- "}${dice[4]}` : "";
    return {
      number: Number(dice[1]),
      denomination: Number(dice[2]),
      bonus,
      types,
      custom: { enabled: false, formula: "" },
      scaling: { mode: "whole", number: null, formula: "" }
    };
  }
  return {
    number: null,
    denomination: null,
    bonus: "",
    types,
    custom: { enabled: true, formula: normalized },
    scaling: { mode: "whole", number: null, formula: "" }
  };
}

function parseDamageParts(text) {
  const parts = [];
  const pattern = /\b\d+\s+\(([^)]+)\)\s+([a-zA-Z]+)\s+damage/gi;
  let match;
  let previousEnd = 0;
  while ((match = pattern.exec(text)) !== null) {
    const type = match[2].toLowerCase();
    const between = text.slice(previousEnd, match.index).toLowerCase();
    if (parts.length && /\bor\b/.test(between) && parts.at(-1).types.includes(type)) {
      previousEnd = pattern.lastIndex;
      continue;
    }
    const types = DAMAGE_TYPES.has(type) ? [type] : [];
    const part = parseFormula(match[1], types);
    if (!types.length) {
      part.custom.enabled = true;
      part.custom.formula = match[1].replaceAll(/\s+/g, "");
    }
    parts.push(part);
    previousEnd = pattern.lastIndex;
  }
  return parts;
}

function parseHealing(text) {
  const match = text.match(/\bregain(?:s)?\s+\d+\s+\(([^)]+)\)\s+hit points/i);
  return match ? parseFormula(match[1], ["healing"]) : null;
}

function parseTemplate(text) {
  const template = {
    count: "",
    contiguous: false,
    type: "",
    size: "",
    width: "",
    height: "",
    units: ""
  };

  let match = text.match(/(\d+)-foot(?:-long)?,?\s+(\d+)-foot-wide line/i);
  if (match) return { ...template, type: "line", size: match[1], width: match[2], units: "ft" };
  match = text.match(/(\d+)-foot(?:-long)? line/i);
  if (match) return { ...template, type: "line", size: match[1], units: "ft" };
  match = text.match(/(\d+)-foot cone/i);
  if (match) return { ...template, type: "cone", size: match[1], units: "ft" };
  match = text.match(/(\d+)-foot-radius sphere/i);
  if (match) return { ...template, type: "sphere", size: match[1], units: "ft" };
  match = text.match(/within (\d+) feet of (?:it|him|her|the [^.,]+)/i);
  if (match) return { ...template, type: "radius", size: match[1], units: "ft" };
  return template;
}

function parseRange(text, attackMode = null) {
  if (attackMode === "melee") {
    const match = text.match(/reach (\d+) ft\./i);
    return {
      value: match?.[1] ?? "5",
      units: "ft",
      special: "",
      override: false
    };
  }
  if (attackMode === "ranged") {
    const match = text.match(/range (\d+)(?:\/(\d+))? ft\./i);
    return {
      value: match?.[1] ?? "",
      units: "ft",
      special: match?.[2] ? `${match[1]}/${match[2]} ft.` : "",
      override: false
    };
  }
  const match = text.match(/within (\d+) feet/i);
  if (match) return { value: match[1], units: "ft", special: "", override: false };
  if (/touch(?:es)?\b/i.test(text)) return { units: "touch", special: "", override: false };
  return { units: "", special: "", override: false };
}

function targetData(text) {
  const count = text.match(/\b(?:one|1) (?:creature|target)\b/i) ? "1" : "";
  return {
    template: parseTemplate(text),
    affects: {
      count,
      type: count ? "creature" : "",
      choice: false,
      special: ""
    },
    prompt: true,
    override: false
  };
}

function baseActivity(id, type, activationType, activationValue, text, consumptionTargets = []) {
  return {
    _id: id,
    type,
    activation: {
      type: activationType,
      value: activationValue,
      condition: "",
      override: false
    },
    consumption: {
      targets: consumptionTargets,
      scaling: { allowed: false, max: "" },
      spellSlot: true
    },
    description: { chatFlavor: "" },
    duration: {
      concentration: false,
      value: "",
      units: "",
      special: "",
      override: false
    },
    effects: [],
    range: parseRange(text),
    target: targetData(text),
    uses: { spent: 0, max: "", recovery: [] },
    sort: 0,
    name: "",
    img: "",
    appliedEffects: []
  };
}

function parseUses(qualifier) {
  if (!qualifier) return { max: "", spent: 0, recovery: [] };
  const recharge = qualifier.match(/^Recharge\s+(\d)(?:\s*[-–]\s*\d)?$/i);
  if (recharge) {
    return {
      max: "1",
      spent: 0,
      recovery: [{ period: "recharge", formula: recharge[1], type: "recoverAll" }]
    };
  }
  const daily = qualifier.match(/^(\d+)\/Day$/i);
  if (daily) {
    return {
      max: daily[1],
      spent: 0,
      recovery: [{ period: "day", type: "recoverAll" }]
    };
  }
  return { max: "", spent: 0, recovery: [] };
}

function consumptionTargets({ hasUses, legendaryCost }) {
  const targets = [];
  if (hasUses) {
    targets.push({
      type: "itemUses",
      target: "",
      value: "1",
      scaling: { mode: "", formula: "" }
    });
  }
  if (legendaryCost) {
    targets.push({
      type: "attribute",
      target: "resources.legact.value",
      value: String(legendaryCost),
      scaling: { mode: "", formula: "" }
    });
  }
  return targets;
}

function makeActivities(seed, section, description, uses, qualifier) {
  const activities = {};
  const defaultActivation = SECTION_ACTIVATION[section] ?? "special";
  const costMatch = qualifier?.match(/^Costs?\s+(\d+)\s+Actions?$/i);
  const legendaryCost = section === "legendaryActions" ? Number(costMatch?.[1] ?? 1) : 0;
  const activationValue = defaultActivation === "legendary" ? legendaryCost : 1;
  const hasUses = Boolean(uses.max);
  const primaryConsumption = consumptionTargets({ hasUses, legendaryCost });
  const attack = description.match(/(?:(Melee|Ranged|Melee or Ranged)\s+)?(Weapon|Spell) Attack:\s*\+(\d+)\s+to hit/i);
  const save = description.match(/DC\s+(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
  const healing = parseHealing(description);

  let activityIndex = 0;
  const add = (kind, data, primary = activities && Object.keys(activities).length === 0) => {
    const id = stableId(`${seed}:activity:${activityIndex}:${kind}`);
    const activity = baseActivity(
      id,
      kind,
      defaultActivation,
      activationValue,
      description,
      primary ? primaryConsumption : []
    );
    Object.assign(activity, data);
    activity.sort = activityIndex * 100000;
    activities[id] = activity;
    activityIndex += 1;
  };

  if (attack) {
    const attackModes = attack[1]?.toLowerCase() === "melee or ranged"
      ? ["melee", "ranged"]
      : [attack[1]?.toLowerCase() ?? "melee"];
    const saveIndex = save ? description.indexOf(save[0]) : -1;
    const hitIndex = description.indexOf("Hit:");
    const hitText = hitIndex >= 0
      ? description.slice(hitIndex, saveIndex > hitIndex ? saveIndex : undefined)
      : description;
    const parts = parseDamageParts(hitText);
    for (const mode of attackModes) {
      add("attack", {
        name: attackModes.length > 1 ? (mode === "melee" ? "Melee" : "Ranged") : "",
        range: parseRange(description, mode),
        attack: {
          ability: "none",
          bonus: attack[3],
          critical: { threshold: null },
          flat: true,
          type: {
            value: mode,
            classification: attack[2].toLowerCase()
          }
        },
        damage: {
          critical: { bonus: "" },
          includeBase: false,
          parts
        }
      });
    }
  }

  if (save) {
    const saveText = attack ? description.slice(description.indexOf(save[0])) : description;
    add("save", {
      range: parseRange(description),
      damage: {
        onSave: /half as much damage|half damage/i.test(description) ? "half" : "none",
        parts: parseDamageParts(saveText)
      },
      save: {
        ability: ABILITY_NAMES[save[2]],
        dc: { calculation: "", formula: save[1] }
      }
    });
  }

  if (healing) {
    add("heal", {
      range: parseRange(description),
      healing
    });
  }

  if (!attack && !save && !healing) {
    const damage = parseDamageParts(description);
    if (damage.length) {
      add("damage", {
        damage: {
          critical: { allow: false, bonus: "" },
          parts: damage
        }
      });
    } else if (section !== "traits" || hasUses) {
      add("utility", {
        roll: { formula: "", name: "", prompt: false, visible: false }
      });
    }
  }

  return activities;
}

function splitTitle(rawTitle) {
  const match = rawTitle.match(/^(.*?)\s+\(([^()]*)\)$/);
  return match
    ? { name: match[1], qualifier: match[2] }
    : { name: rawTitle, qualifier: "" };
}

function featureIcon(section, activities) {
  const types = Object.values(activities).map((activity) => activity.type);
  if (types.includes("heal")) return "icons/svg/heal.svg";
  if (types.includes("attack")) return "icons/svg/sword.svg";
  if (types.includes("save") || types.includes("damage")) return "icons/svg/explosion.svg";
  if (section === "reactions") return "icons/svg/shield.svg";
  if (section === "bonusActions") return "icons/svg/wing.svg";
  return "icons/svg/aura.svg";
}

function makeFeature(actorId, rawTitle, description, section, index, sourceName) {
  const { name, qualifier } = splitTitle(rawTitle);
  const seed = `${actorId}:${section}:${index}:${name}`;
  const id = stableId(seed);
  const uses = parseUses(qualifier);
  const activities = makeActivities(seed, section, description, uses, qualifier);
  const sectionLabel = {
    traits: "Trait",
    actions: "Action",
    bonusActions: "Bonus Action",
    reactions: "Reaction",
    legendaryActions: "Legendary Action"
  }[section];

  return {
    _id: id,
    name,
    type: "feat",
    img: featureIcon(section, activities),
    system: {
      description: {
        value: `<p>${escapeHtml(description)}</p>`,
        chat: ""
      },
      source: {
        custom: sourceName,
        book: "",
        page: "",
        license: "",
        rules: "2014",
        revision: 1
      },
      uses,
      type: { value: "monster", subtype: "" },
      requirements: "",
      properties: [],
      activities,
      enchant: {},
      prerequisites: { level: null },
      identifier: slugify(name)
    },
    effects: [],
    folder: null,
    sort: index * 100000,
    ownership: { default: 0 },
    flags: {
      "rise-of-venegon": {
        section,
        sectionLabel,
        qualifier
      }
    },
    _stats: {
      compendiumSource: null,
      duplicateSource: null,
      coreVersion: "14.365",
      systemId: "dnd5e",
      systemVersion: "5.3.3",
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
      exportSource: null
    },
    _key: `!actors.items!${actorId}.${id}`
  };
}

function addReferencedLegendaryAttacks(items) {
  const actionItems = new Map(items
    .filter((item) => item.flags["rise-of-venegon"].section === "actions")
    .map((item) => [item.name.toLowerCase(), item]));

  for (const item of items) {
    if (item.flags["rise-of-venegon"].section !== "legendaryActions") continue;
    if (!Object.values(item.system.activities).every((activity) => activity.type === "utility")) continue;
    const match = item.system.description.value.match(/makes one (.+?) attack/i);
    if (!match) continue;
    const referenced = actionItems.get(match[1].trim().toLowerCase());
    const attacks = Object.values(referenced?.system.activities ?? {})
      .filter((activity) => activity.type === "attack");
    if (!attacks.length) continue;

    const costMatch = item.flags["rise-of-venegon"].qualifier.match(/^Costs?\s+(\d+)\s+Actions?$/i);
    const cost = Number(costMatch?.[1] ?? 1);
    item.system.activities = Object.fromEntries(attacks.map((attack, index) => {
      const id = stableId(`${item._id}:referenced-attack:${index}`);
      const clone = structuredClone(attack);
      clone._id = id;
      clone.activation = { type: "legendary", value: cost, condition: "", override: false };
      clone.consumption.targets = consumptionTargets({ hasUses: false, legendaryCost: cost });
      clone.sort = index * 100000;
      return [id, clone];
    }));
    item.img = "icons/svg/sword.svg";
  }
}

function parseIdentity(line) {
  const match = line.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,(]+?)(?:\s+\(([^)]+)\))?,\s*(.+)$/i);
  if (!match) throw new Error(`Unable to parse identity line: ${line}`);
  const sizeName = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  return {
    size: SIZE_KEYS[sizeName],
    type: match[2].trim().toLowerCase(),
    subtype: match[3]?.trim() ?? "",
    alignment: match[4].trim()
  };
}

function parseMovement(line) {
  const movement = {
    walk: 0,
    burrow: 0,
    climb: 0,
    fly: 0,
    swim: 0,
    bonus: "",
    special: "",
    units: "ft",
    hover: /\(hover\)/i.test(line),
    ignoredDifficultTerrain: []
  };
  const terms = line.replace(/^Speed\s+/i, "").split(",").map((term) => term.trim());
  for (const term of terms) {
    const typed = term.match(/^(burrow|climb|fly|swim|walk)\s+(\d+)\s+ft\./i);
    const untyped = term.match(/^(\d+)\s+ft\./i);
    if (typed) movement[typed[1].toLowerCase()] = Number(typed[2]);
    else if (untyped) movement.walk = Number(untyped[1]);
    else movement.special = [movement.special, term].filter(Boolean).join("; ");
  }
  return movement;
}

function parseTrait(line, prefix) {
  const raw = line?.slice(prefix.length).trim() ?? "";
  const segments = raw.split(";").map((part) => part.trim()).filter(Boolean);
  const conditional = segments.filter((part) => /nonmagical|not silvered|not adamantine/i.test(part));
  const unconditional = segments.filter((part) => !conditional.includes(part));
  const typesIn = (parts) => [...DAMAGE_TYPES].filter((type) =>
    parts.some((part) => new RegExp(`\\b${type}\\b`, "i").test(part))
  );

  // Foundry applies bypasses to every selected damage type. Mixed traits such
  // as "cold; bludgeoning from nonmagical attacks" therefore need to keep the
  // conditional clause as custom text so the unconditional types stay correct.
  if (conditional.length && unconditional.length) {
    const residue = unconditional.filter((part) => !typesIn([part]).length);
    return {
      value: typesIn(unconditional),
      bypasses: [],
      custom: [...conditional, ...residue].join("; ")
    };
  }

  const bypasses = [];
  if (/nonmagical/i.test(raw)) bypasses.push("mgc");
  if (/not silvered/i.test(raw)) bypasses.push("sil");
  if (/not adamantine/i.test(raw)) bypasses.push("ada");
  const values = typesIn(segments);
  const residue = segments.filter((part) => !typesIn([part]).length);
  return { value: values, bypasses, custom: residue.join("; ") };
}

function parseConditionImmunities(line) {
  const raw = line?.replace(/^Condition Immunities\s+/i, "") ?? "";
  const values = [...CONDITIONS].filter((condition) => new RegExp(`\\b${condition}\\b`, "i").test(raw));
  const custom = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && !CONDITIONS.has(value.toLowerCase()))
    .join("; ");
  return { value: values, custom };
}

function parseLanguages(line) {
  const raw = line?.replace(/^Languages\s+/i, "") ?? "";
  const communication = {};
  const telepathy = raw.match(/telepathy\s+(\d+)\s+ft\./i);
  if (telepathy) communication.telepathy = { value: Number(telepathy[1]), units: "ft" };
  const custom = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && !/^telepathy\b/i.test(value))
    .join("; ");
  return { value: [], custom, communication };
}

function parseSenses(line) {
  const raw = line?.replace(/^Senses\s+/i, "") ?? "";
  const ranges = {};
  for (const sense of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
    const match = raw.match(new RegExp(`${sense}\\s+(\\d+)\\s+ft\\.`, "i"));
    if (match) ranges[sense] = Number(match[1]);
  }
  const special = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && !/^(?:darkvision|blindsight|tremorsense|truesight|passive Perception)\b/i.test(value))
    .join("; ");
  return { ranges, units: "ft", special };
}

function parseNamedBonuses(line, prefix) {
  const result = new Map();
  if (!line) return result;
  const raw = line.slice(prefix.length).trim();
  const pattern = /([A-Za-z ]+?)\s+([+-]\d+)(?:,|$)/g;
  let match;
  while ((match = pattern.exec(raw)) !== null) result.set(match[1].trim(), Number(match[2]));
  return result;
}

function emptyAbility(value) {
  return {
    value,
    proficient: 0,
    max: null,
    bonuses: { check: "", save: "" },
    check: { roll: { min: null, max: null, mode: 0 } },
    save: { roll: { min: null, max: null, mode: 0 } }
  };
}

function skillData(value, ability, bonus = "") {
  return {
    value,
    ability,
    bonuses: { check: bonus, passive: "" },
    roll: { min: null, max: null, mode: 0 }
  };
}

function parseFeatures(lines, actorId, warnings, sourceName) {
  const sections = {
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: []
  };
  let section = "traits";
  let legendaryActions = 0;

  for (const line of lines) {
    if (line === "Actions") {
      section = "actions";
      continue;
    }
    if (line === "Bonus Actions") {
      section = "bonusActions";
      continue;
    }
    if (line === "Reactions") {
      section = "reactions";
      continue;
    }
    if (line === "Legendary Actions") {
      section = "legendaryActions";
      continue;
    }

    const legendaryIntro = line.match(/can take\s+(\d+)\s+legendary actions?/i);
    if (legendaryIntro) {
      legendaryActions = Number(legendaryIntro[1]);
      continue;
    }

    const delimiter = line.indexOf(". ");
    if (delimiter < 1) {
      warnings.push(`Unparsed feature line: ${line}`);
      continue;
    }
    sections[section].push({
      title: line.slice(0, delimiter),
      description: line.slice(delimiter + 2)
    });
  }

  const items = [];
  let index = 1;
  for (const [sectionName, features] of Object.entries(sections)) {
    for (const feature of features) {
      items.push(makeFeature(actorId, feature.title, feature.description, sectionName, index, sourceName));
      index += 1;
    }
  }

  addReferencedLegendaryAttacks(items);
  return { items, legendaryActions };
}

export function parseActor(record, folderId, artMap = {}) {
  const warnings = [];
  const sourceName = record.supplement ?? "Beneath the Living Mist";
  const lines = record.text
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const name = lines[0];
  if (name !== record.name) warnings.push(`Index name "${record.name}" differs from statblock name "${name}"`);
  const identity = parseIdentity(lines[1]);
  const actorId = stableId(`actor:${record.path}:${name}`);
  const slug = slugify(name);

  const abilityStart = lines.findIndex((line, index) =>
    line === "STR" && lines.slice(index, index + 6).join(",") === "STR,DEX,CON,INT,WIS,CHA"
  );
  if (abilityStart < 0) throw new Error(`Unable to locate ability row for ${name}`);
  const scoreMatches = [...lines[abilityStart + 6].matchAll(/(\d+)\s+\(([+-]\d+)\)/g)];
  if (scoreMatches.length !== 6) throw new Error(`Expected six ability scores for ${name}`);

  const abilities = Object.fromEntries(ABILITIES.map((ability, index) => [
    ability,
    emptyAbility(Number(scoreMatches[index][1]))
  ]));
  const modifiers = Object.fromEntries(ABILITIES.map((ability) => [
    ability,
    Math.floor((abilities[ability].value - 10) / 2)
  ]));

  const header = lines.slice(2, abilityStart);
  const afterAbilities = lines.slice(abilityStart + 7);
  const challengeIndex = afterAbilities.findIndex((line) => line.startsWith("Challenge "));
  if (challengeIndex < 0) throw new Error(`Unable to locate Challenge for ${name}`);
  const fields = afterAbilities.slice(0, challengeIndex + 1);
  const featureLines = afterAbilities.slice(challengeIndex + 1);

  const acLine = header.find((line) => line.startsWith("Armor Class "));
  const hpLine = header.find((line) => line.startsWith("Hit Points "));
  const speedLine = header.find((line) => line.startsWith("Speed "));
  const acMatch = acLine?.match(/^Armor Class\s+(\d+)(?:\s+\(([^)]+)\))?/i);
  const hpMatch = hpLine?.match(/^Hit Points\s+(\d+)\s+\(([^)]+)\)/i);
  if (!acMatch || !hpMatch || !speedLine) throw new Error(`Missing AC, HP, or Speed for ${name}`);

  const challengeLine = fields.find((line) => line.startsWith("Challenge "));
  const challengeMatch = challengeLine.match(/^Challenge\s+([0-9/]+)\s+\(([\d,]+)\s+XP\)/i);
  if (!challengeMatch) throw new Error(`Unable to parse Challenge line for ${name}: ${challengeLine}`);
  const cr = parseCr(challengeMatch[1]);
  const pb = proficiencyBonus(cr);

  const savingThrows = parseNamedBonuses(fields.find((line) => line.startsWith("Saving Throws ")), "Saving Throws");
  for (const [nameKey, bonus] of savingThrows) {
    const ability = ABILITIES.find((key) => nameKey.toLowerCase().startsWith(key));
    if (!ability) {
      warnings.push(`Unknown saving throw "${nameKey}"`);
      continue;
    }
    if (bonus === modifiers[ability] + pb) abilities[ability].proficient = 1;
    else abilities[ability].bonuses.save = signed(bonus - modifiers[ability]);
  }

  const skills = {};
  const skillBonuses = parseNamedBonuses(fields.find((line) => line.startsWith("Skills ")), "Skills");
  for (const [skillName, bonus] of skillBonuses) {
    const config = SKILLS[skillName];
    if (!config) {
      warnings.push(`Unknown skill "${skillName}"`);
      continue;
    }
    const [key, ability] = config;
    const difference = bonus - modifiers[ability];
    const multiplier = difference / pb;
    if ([0, 0.5, 1, 2].includes(multiplier)) skills[key] = skillData(multiplier, ability);
    else skills[key] = skillData(0, ability, signed(difference));
  }

  const { items, legendaryActions } = parseFeatures(featureLines, actorId, warnings, sourceName);
  const legendaryResistance = items.find((item) => item.name === "Legendary Resistance");
  const art = artMap[slug] ?? {};
  const img = art.img ?? "icons/svg/mystery-man.svg";
  const token = art.token ?? img;
  const tokenSize = TOKEN_SIZES[identity.size] ?? 1;
  const senseLine = fields.find((line) => line.startsWith("Senses "));
  const languageLine = fields.find((line) => line.startsWith("Languages "));
  const conditionLine = fields.find((line) => line.startsWith("Condition Immunities "));
  const resistanceLine = fields.find((line) => line.startsWith("Damage Resistances "));
  const immunityLine = fields.find((line) => line.startsWith("Damage Immunities "));
  const vulnerabilityLine = fields.find((line) => line.startsWith("Damage Vulnerabilities "));

  const actor = {
    _id: actorId,
    name,
    type: "npc",
    img,
    system: {
      abilities,
      attributes: {
        ac: {
          flat: Number(acMatch[1]),
          calc: "natural",
          formula: ""
        },
        hp: {
          value: Number(hpMatch[1]),
          max: Number(hpMatch[1]),
          temp: 0,
          tempmax: 0,
          formula: hpMatch[2].replaceAll(/\s+/g, " ").trim()
        },
        init: {
          ability: "",
          bonus: "0",
          roll: { min: null, max: null, mode: 0 }
        },
        movement: parseMovement(speedLine),
        attunement: { max: 3 },
        senses: parseSenses(senseLine),
        spellcasting: "",
        spell: { level: 0 },
        exhaustion: 0,
        concentration: {
          ability: "",
          roll: { min: null, max: null, mode: 0 },
          bonuses: { save: "" },
          limit: 1
        },
        hd: { spent: 0 },
        death: {
          ability: "",
          roll: { min: null, max: null, mode: 0 },
          success: 0,
          failure: 0,
          bonuses: { save: "" }
        }
      },
      details: {
        biography: {
          value: [
            `<h2>${escapeHtml(record.supplement ?? "Beneath the Living Mist")}</h2>`,
            `<p><strong>Faction:</strong> ${escapeHtml(record.chapterLabel)}</p>`,
            `<p><strong>Role:</strong> ${escapeHtml(record.role)}</p>`,
            `<p><strong>Source:</strong> ${escapeHtml(record.path)}</p>`
          ].join(""),
          public: ""
        },
        alignment: identity.alignment,
        race: null,
        type: {
          value: identity.type,
          subtype: identity.subtype,
          swarm: "",
          custom: ""
        },
        habitat: {
          value: [],
          custom: "Umbral Marches"
        },
        cr,
        treasure: { value: [] },
        ideal: "",
        bond: "",
        flaw: ""
      },
      traits: {
        size: identity.size,
        di: immunityLine ? parseTrait(immunityLine, "Damage Immunities") : { value: [], bypasses: [], custom: "" },
        dr: resistanceLine ? parseTrait(resistanceLine, "Damage Resistances") : { value: [], bypasses: [], custom: "" },
        dv: vulnerabilityLine ? parseTrait(vulnerabilityLine, "Damage Vulnerabilities") : { value: [], bypasses: [], custom: "" },
        ci: conditionLine ? parseConditionImmunities(conditionLine) : { value: [], custom: "" },
        languages: parseLanguages(languageLine),
        dm: { amount: {}, bypasses: [] },
        important: false
      },
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      skills,
      tools: {},
      spells: {},
      bonuses: {
        mwak: { attack: "", damage: "" },
        rwak: { attack: "", damage: "" },
        msak: { attack: "", damage: "" },
        rsak: { attack: "", damage: "" },
        abilities: { check: "", save: "", skill: "" },
        spell: { dc: "" }
      },
      resources: {
        legact: { max: legendaryActions, spent: 0 },
        legres: {
          max: Number(legendaryResistance?.system.uses.max || 0),
          spent: 0
        },
        lair: { value: false, initiative: 20, inside: false }
      },
      source: {
        custom: sourceName,
        book: "",
        page: "",
        license: "",
        rules: "2014",
        revision: 1
      }
    },
    prototypeToken: {
      name,
      displayName: 20,
      actorLink: false,
      width: tokenSize,
      height: tokenSize,
      lockRotation: false,
      rotation: 0,
      disposition: -1,
      displayBars: 20,
      bar1: { attribute: "attributes.hp" },
      bar2: { attribute: null },
      flags: {},
      randomImg: false,
      alpha: 1,
      texture: {
        src: token,
        tint: "#ffffff",
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        anchorX: 0.5,
        anchorY: 0.5,
        fit: "contain",
        alphaThreshold: 0.75
      },
      sight: {
        angle: 360,
        enabled: false,
        range: Math.max(0, ...Object.values(parseSenses(senseLine).ranges)),
        brightness: 1,
        visionMode: "basic",
        color: null,
        attenuation: 0.1,
        saturation: 0,
        contrast: 0
      },
      detectionModes: [],
      appendNumber: false,
      prependAdjective: false,
      occludable: { radius: 0 },
      ring: {
        enabled: false,
        colors: { ring: null, background: null },
        effects: 1,
        subject: { scale: 1, texture: null }
      },
      turnMarker: {
        mode: 1,
        animation: null,
        src: null,
        disposition: false
      },
      movementAction: null
    },
    items,
    effects: [],
    folder: folderId,
    sort: 0,
    ownership: { default: 0 },
    flags: {
      "rise-of-venegon": {
        slug,
        role: record.role,
        chapter: record.chapterLabel,
        section: record.section,
        party: record.party,
        sourcePath: record.path,
        placeholderArt: !art.img && !art.token
      }
    },
    _stats: {
      compendiumSource: null,
      duplicateSource: null,
      coreVersion: "14.365",
      systemId: "dnd5e",
      systemVersion: "5.3.3",
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
      exportSource: null
    },
    _key: `!actors!${actorId}`
  };

  return { actor, warnings };
}

export function makeFolder(name, parentId = null, sort = 0) {
  const id = stableId(`folder:${parentId ?? "root"}:${name}`);
  return {
    document: {
      name,
      type: "Actor",
      _id: id,
      folder: parentId,
      sorting: "a",
      sort,
      flags: {},
      _stats: {
        systemId: "dnd5e",
        systemVersion: "5.3.3",
        coreVersion: "14.365",
        createdTime: null,
        modifiedTime: null,
        lastModifiedBy: null
      },
      _key: `!folders!${id}`
    },
    id
  };
}
