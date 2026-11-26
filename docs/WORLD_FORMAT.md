# The .world file format

A `.world` file holds one WorldAtlas world, complete: its settings and calendar, every article, every map, its version history and every picture. People make one with **World settings → Export .world** and open one with **Open a file** (or **Open .world** on the worlds page).

It's the format to read if you're writing a tool that imports from WorldAtlas, such as a module for a virtual tabletop. Why read this file rather than anything else:

- **It's the whole world in one file**, pictures included. There's no server, API or sign-in to deal with, and it works offline.
- **The user chooses to export it.** Nothing reads their worlds behind their back, and it works however they store them (OneDrive, a synced folder, or only on one device).
- **It's the stable format.** The sync folder's layout and the app's database are internal and change; this file is versioned (below), and a change that would break a reader gets a new version number.

The simpler [import format](IMPORT_FORMAT.md) is for writing *into* WorldAtlas (by hand or with an AI assistant). It has no maps or pictures, so it isn't the right thing to read a world *out* of.

---

## Versions and compatibility

- `manifest.json` → `version` is the file format's version: currently **1**. It goes up only for a change that would break a reader written for the previous one (removing or renaming something, or changing what a value means). A reader should refuse, or warn about, a version it doesn't know.
- New keys are added without a version change. **Ignore keys you don't recognise**, and expect any optional key to be missing.
- `manifest.json` → `appVersion` is the WorldAtlas version that wrote the file (e.g. `1.73.1`), useful for bug reports.

## The archive

A standard zip archive. WorldAtlas writes entries uncompressed (*stored*) with UTF-8 names; other tools may write deflated entries, and WorldAtlas reads both. Any zip library will do.

```
manifest.json      what this is, and the list of pictures
world.json         the world, its articles and its maps
history.json       earlier versions of its articles (optional to read)
images/<id>        each picture or font, its raw bytes (no file extension)
```

### manifest.json

```json
{
  "app": "WorldAtlas",
  "kind": "world",
  "version": 1,
  "appVersion": "1.73.1",
  "name": "Aerthal",
  "exportedAt": "2026-11-26T10:28:48.757Z",
  "images": [
    { "id": "b717ec88-…", "type": "image/jpeg", "file": "images/b717ec88-…" }
  ]
}
```

Check `app === "WorldAtlas"` and `kind === "world"` before reading on. `images` lists every file under `images/`, with its media type (`image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, or a font type for a world's fonts). Records refer to pictures by `id`.

### world.json

```json
{ "app": "WorldAtlas", "version": 2, "worlds": [ { … } ], "articles": [ … ], "maps": [ … ] }
```

`worlds` holds exactly one world. `articles` and `maps` are that world's (each has `worldId` set to the world's `id`). Deleted articles and maps aren't included.

### history.json

```json
{ "history": [ { "id": "…", "articleId": "…", "worldId": "…", "savedAt": 1795688928388, "snapshot": { "title": "…", "body": "…", … } } ] }
```

Earlier versions of articles, in no particular order (sort by `savedAt`). An importer can ignore it.

---

## Common conventions

- **IDs** are strings (usually UUIDs). Records refer to each other by ID: an article's `parentId`, a relationship's `target`, a pin's `articleId`.
- **Times** (`createdAt`, `updatedAt`, `savedAt`) are milliseconds since 1970 (UTC).
- **Text** is Markdown, with WorldAtlas's additions: see [Article text](#article-text).
- **Template IDs, relationship types and icon names** are stable identifiers; the names people see (*Organization*, *Led by*) can change.
- **Pictures** are referenced by image ID, found in `manifest.json` → `images` and stored at `images/<id>`.
- **Positions on a map** are fractions of the map picture's size: `x` from 0 (left edge) to 1 (right edge), `y` from 0 (top) to 1 (bottom). Multiply by the picture's width and height in pixels to place things.
- Most keys are optional, and may be `null`, an empty string or missing: treat all three as "not set".

---

## The world

| Key | Meaning |
|---|---|
| `id`, `name` | The world's ID and name. |
| `subtitle` | A line under the name on its overview. |
| `description` | Markdown, shown on the overview. |
| `image` | Cover picture (image ID). `imagePos` is its framing as `[x%, y%]`; `imageZoom` a zoom factor (1 = none). |
| `calendar` | The world's calendar: see [Calendar](#calendar). Missing means an Earth-like calendar. |
| `templates` | The world's own article templates, and its changes to the built-in ones: see [Templates](#templates). |
| `fonts` | The world's own fonts, for runes and invented scripts: `[{ "name": "Dwarvish", "file": "<image id>" }]`. |
| `codex` | How the sidebar is arranged: `{ "order": [template ids], "hidden": [template ids] }`. |
| `background`, `noise`, `heroEdge`, `infobox`, `cardPos`, `cardZoom`, `prompts`, `notDuplicates` | Appearance and app state; an importer can ignore them. |

### Calendar

```json
{
  "months": [{ "name": "Deepwinter", "days": 30 }, …],
  "weekdays": ["Firstday", "Seconday", …],
  "eras": [{ "name": "After the Falling", "abbr": "AF", "start": 0, "countFromOne": false }],
  "moons": [{ "name": "Selune", "cycle": 30, "offset": 3, "color": "#d9cfb8" }],
  "epochWeekday": 0,
  "currentYear": 1043
}
```

An era runs from its `start` year until the next era begins; its `abbr` follows a year when shown (`1042 AF`). Years are plain numbers and can be negative.

---

## Articles

| Key | Meaning |
|---|---|
| `id`, `worldId` | |
| `title` | Unique within the world. |
| `aliases` | Other names it goes by: `["The Iron Queen"]`. `[[links]]` to any of them lead to this article. |
| `type` | Its template: one of the built-in ones below, or a world's own (`c-…`, see [Templates](#templates)). Unknown types should be treated as `article`. |
| `parentId` | The article it's filed under (a district's city, say), or `null`. |
| `summary` | A line or two, shown in lists and link previews. |
| `body` | The article's text: Markdown, see [Article text](#article-text). |
| `gmNotes` | GM-only notes (Markdown), folded away when reading. **Don't show these to players.** |
| `fields` | The infobox, as `{ "Field name": "value" }`. Values are short Markdown and may hold `[[links]]`. The template decides the usual fields and their order; any field name may appear. |
| `tags` | `["capital", "vael"]`. |
| `image` | Portrait or picture for the infobox (image ID), framed by `imagePos` (`[x%, y%]`) and `imageZoom`. |
| `banner` | Wide header picture (image ID), framed by `bannerPos` and `bannerZoom`. |
| `mapId` | A map this article opens (a city's own map, say). |
| `start`, `startM`, `startD` | When it happened or began: year, month, day. **Months are 0-based** (0 = the calendar's first month); month and day may be missing. |
| `end`, `endM`, `endD` | When it ended, the same way. |
| `dateLabel` | Text shown instead of the date (*"The Long Winter"*). |
| `relations` | Relationships stored on this article: see [Relationships](#relationships). |
| `relOrder` | The order the user put its relationships in (keys of the form `"<type>:<article id>"`); ignorable. |
| `conflict` | Present while the user has two versions to choose between (from editing on two devices); the article's own keys are the current version. |

Built-in `type`s: `character`, `species`, `culture`, `profession`, `title`, `location`, `settlement`, `building`, `organization`, `religion`, `event`, `conflict`, `plot`, `myth`, `spell`, `law`, `condition`, `technology`, `item`, `vehicle`, `material`, `tradition`, `language`, `lore`, `article`. Settlements and buildings are kinds of location, and conflicts a kind of event (the app lists them together).

### Article text

Standard Markdown (as [marked](https://marked.js.org) reads it: headings, lists, emphasis, tables, block quotes, code), plus:

| Syntax | Meaning |
|---|---|
| `[[Title]]`, `[[Title\|shown text]]`, `[[Title#Heading]]` | A link to another article, by its title or one of its aliases (case-insensitive). A link to a title no article has yet is valid: it's a page waiting to be written. |
| `![[Title#Heading]]` on its own line | An excerpt: that section of another article shown here (`![[Title]]` shows its summary). |
| `> [!note] Optional title` then `> text` lines | A callout box: `note`, `tip`, `info`, `important`, `warning`, `danger` or `quote`. `[!note]-` starts folded, `[!note]+` folded open. |
| `:::cursive` … `:::` | A handwritten passage (`cursive`, `print`, or one of the world's own fonts by name). `{{Font name\|text}}` does the same inline. |
| Markdown tables | Readers can sort, search and roll on them, and roll the dice in them: see [Tables](TABLES.md). |
| ` ```statblock ` fences | A creature's or character's statistics: see [Statblocks](STATBLOCKS.md). |

### Relationships

```json
"relations": [
  { "id": "…", "type": "child", "target": "<article id>", "note": "" },
  { "id": "…", "type": "rival", "target": "", "name": "Mother Wick", "note": "an uneasy truce" }
]
```

- A relationship is stored **once**, on one of the two articles, and reads from that article's side: `child` on *Queen Ysolde* with `target` *King Aldric* means Ysolde is Aldric's child. The other article has the reverse (Aldric is *parent of* Ysolde) without storing it, so **to list an article's relationships, also look through other articles for relations whose `target` is it**, and use the reverse type.
- `target` is an article ID. When it's empty, `name` names a person or place with no article yet.
- Types and their reverses:

| Type | Reads as | Reverse |
|---|---|---|
| `parent` / `child` | Parent of / Child of | each other |
| `spouse`, `sibling`, `partner`, `friend`, `ally`, `rival`, `enemy`, `related` | … of | itself |
| `mentor` / `student` | Mentor of / Student of | each other |
| `member` / `hasMember` | Member of / Has member | each other |
| `leader` / `ledBy` | Leader of / Led by | each other |
| `deputy` / `hasDeputy` | Deputy of / Has deputy | each other |
| `rules` / `ruledBy` | Rules / Ruled by | each other |
| `serves` / `servedBy` | Serves / Served by | each other |
| `worships` / `worshippedBy` | Worships / Worshipped by | each other |
| `created` / `createdBy` | Creator of / Created by | each other |
| `invented` / `inventedBy` | Inventor of / Invented by | each other |
| `owns` / `ownedBy` | Owner of / Owned by | each other |
| `locatedIn` / `locationOf` | Located in / Location of | each other |

New types may be added in later versions; skip ones you don't know.

### Templates

`world.templates` (optional) maps a template ID to either:

- **a template the user made**, with an ID starting `c-`:
  ```json
  "c-1a2b3c4d": {
    "custom": true, "label": "Noble House", "plural": "Noble Houses", "icon": "crown",
    "group": "groups", "base": "organization", "hint": "A ruling family.",
    "sections": [{ "name": "Overview", "fields": ["Seat", "Founded"] }],
    "fill": { "Seat": "locatedIn" },
    "outline": "## Lineage\n> [!prompt] Who rules?\n\n## Holdings"
  }
  ```
  `base` is a built-in type it works like (so a Noble House can be treated as an organisation); `group` is the category it's listed under. `sections` lists its infobox fields; `fill` says which relationship fills an empty field. `outline` is what new articles start with (`> [!prompt]` lines are never saved into articles).
- **changes to a built-in template** for this world, keyed by its type (`"character": { "sections": […], "fill": {…}, "outline": "…" }`), containing only what was changed.

`icon` names are [Phosphor](https://phosphoricons.com) icons.

---

## Maps

| Key | Meaning |
|---|---|
| `id`, `worldId`, `name` | |
| `image` | The map picture (image ID). |
| `pins` | Places on the map: see below. |
| `regions` | Areas on the map: see below. |
| `scale` | `{ "perPx": 0.2, "unit": "miles" }`: the distance one pixel of the picture covers. `pace` is a day's travel in that unit. |
| `layerOrder` | The order of the map's layers (groups) in its key. |
| `pinStyle` | `"numbers"` when pins show numbers, with a key listing the names (numbered in key order). |
| `pinShape`, `pinFinish`, `fit`, `frame`, `bgGrid`, `grid`, `view` | Display settings: marker shape and style, window fitting, frame, background grid, a square or hex grid over the map (`{ "kind": "hex", "size": 70 }`, size in picture pixels), and the starting view (`{ x, y, z }`). |

### Pins

```json
{ "id": "…", "x": 0.4656, "y": 0.4591, "label": "", "articleId": "<article id>", "mapId": "",
  "icon": "castle-turret", "color": "#9b2f1e", "layer": "Old Town", "hide": true }
```

- `x`, `y`: where the pin points, as fractions of the picture (see [conventions](#common-conventions)).
- Its name is `label`, or if that's empty, the title of the article it links to (`articleId`), or of the map it opens (`mapId`).
- `layer`: the group it's in, in the map's key.
- `hide`: the map picture already shows this place's name, so WorldAtlas draws nothing there (it's still clickable). An importer placing its own markers may want to do the same.

### Regions

```json
{ "id": "…", "points": [[0.75, 0.6], [0.7477, 0.6414], …], "label": "", "articleId": "…",
  "color": "#4f74a8", "fill": "solid", "layer": "Riverside", "hide": false }
```

- `points`: the outline, as `[x, y]` fractions of the picture, in order (the shape closes itself).
- Its name, `layer`, `articleId`, `mapId` and `hide` work as for pins. `fill` is `solid`, `outline` or `hidden` (transparent until hovered).

---

## Bringing a world into another tool

A sketch for a virtual tabletop such as Foundry VTT:

| WorldAtlas | Becomes |
|---|---|
| An article | A journal entry (or a page in one entry per template): its title, `summary`, infobox `fields` and `body` (Markdown → HTML with any Markdown library). |
| `gmNotes` | A GM-only page or secret block; never shown to players. |
| `[[Title]]` links | Links to the matching entries (look titles and aliases up, case-insensitively). Links to articles that don't exist stay as plain text. |
| `image`, `banner` | The entry's image and header, uploaded from `images/<id>`. |
| A map | A scene with the map picture as its background. |
| Pins | Map notes at `x × width`, `y × height`, linked to the article's entry. |
| Regions | Drawings or regions from `points`, scaled the same way. |
| `parentId` | Folder nesting, if the tool has folders. |
| Relationships | A list on each entry ("Child of King Aldric"), remembering the reverse ones stored on the other article. |

Reading one in JavaScript, with [JSZip](https://stuk.github.io/jszip/):

```js
const zip = await JSZip.loadAsync(fileBytes);
const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
if (manifest.app !== 'WorldAtlas' || manifest.kind !== 'world') throw new Error('Not a WorldAtlas world');
if (manifest.version > 1) console.warn('Made by a newer WorldAtlas; some things may be missed');
const { worlds: [world], articles, maps } = JSON.parse(await zip.file('world.json').async('string'));
const picture = async (id) => {
  const img = manifest.images.find((i) => i.id === id);
  return img && new Blob([await zip.file(img.file).async('uint8array')], { type: img.type });
};
```

## Planned changes

Under consideration, not yet made (a new `version` will say when they are):

- **Smaller files:** articles split into one file per template (`articles/character.json`, `articles/location.json`, …) instead of all in `world.json`, so other tools and syncing deal with smaller pieces. A reader written for version 1 would then need updating; the manifest's `version` will tell it.
- **Player editions:** a copy of a world made for players, without GM notes, hidden articles or secret sections, marked as such in the manifest.
