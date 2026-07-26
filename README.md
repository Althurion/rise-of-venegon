# Rise of Venegon

Rise of Venegon is a Foundry Virtual Tabletop content module for Foundry v14
Build 365 and the Dungeons & Dragons Fifth Edition system v5.3.3.

Version 0.2.0 contains 120 ready-to-play NPC Actors from *Beneath the Living
Mist* and *Beneath the Living Mist, Volume II: Classbound NPCs of the Umbral
Marches*. They are held in one Actor compendium and arranged into nested
folders for Dark Elves, Grey Dwarves, Deepwatch Dwarves, and three adventuring
parties.

## Install

In Foundry Setup, open **Add-on Modules**, choose **Install Module**, and paste:

```text
https://raw.githubusercontent.com/Althurion/rise-of-venegon/main/module.json
```

Enable **Rise of Venegon** in a dnd5e world. The **Rise of Venegon NPCs**
compendium will appear in the Compendium Packs sidebar.

## Actor implementation

- AC, HP, movement, abilities, saves, skills, senses, languages, CR, damage
  traits, and condition immunities are populated.
- Traits, actions, bonus actions, reactions, and legendary actions are
  embedded as dnd5e Feature items.
- Attacks use exact statblock attack bonuses and roll their damage parts.
- Saving-throw actions prompt for the listed DC and roll damage where present.
- Healing actions roll healing.
- Recharge, daily uses, and legendary-action costs are represented by dnd5e
  activities and resources.
- Prototype tokens are unlinked and use Foundry's placeholder until artwork is
  assigned through `source/art-map.json`.

## Updating the compendium

The LevelDB pack is generated, not hand-edited:

```bash
npm ci
npm run build
```

New text statblocks can be consolidated with:

```bash
npm run import:statblocks -- /path/to/VTT_Statblocks /path/to/NPC_Index.csv
```

Add a later volume without replacing existing Actors by passing `--append`,
an attribution, and a unique path prefix:

```bash
npm run import:statblocks -- /path/to/VTT_Statblocks /path/to/NPC_Index.csv \
  --append \
  --supplement="Beneath the Living Mist, Volume II" \
  --path-prefix=volume-ii
```

After updating `version` and the versioned download URL in `module.json`, commit
and push the changes to `main`. GitHub Actions builds the compendium and creates
or refreshes the matching release. The stable manifest remains available from
`main`.

## Adding actor art

Place portraits and tokens beneath `assets/`, then map each actor slug in
`source/art-map.json`. See `assets/README.md` for the schema. Rebuilding changes
only image paths; stable actor and item IDs are preserved.

## Source

The initial statblocks are original private-campaign material prepared for the
Rise of Venegon campaign. The module code and data structure are designed for
future expansion as new NPCs are created.
