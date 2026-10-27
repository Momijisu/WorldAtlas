# WorldAtlas import format

A JSON format for adding a world to [WorldAtlas](https://momijisu.github.io/WorldAtlas/), by hand or with an AI assistant. Articles refer to each other by title, so no IDs are needed.

To import, open **Settings → Import a world** and choose **Import from file** or **Paste text**. A preview lists what will change and anything that didn't match.

---

## Quick example

```json
{
  "format": "worldatlas-import",
  "version": 1,
  "world": {
    "name": "Aerthal",
    "description": "A shattered continent where the flying cities of the old **Skyward Empire** fell from the sky.",
    "calendar": {
      "months": [
        { "name": "Deepwinter", "days": 30 }, { "name": "Thawing", "days": 30 }, { "name": "Seedtime", "days": 30 },
        { "name": "Greening", "days": 30 }, { "name": "Highsun", "days": 30 }, { "name": "Midsummer", "days": 30 },
        { "name": "Goldfall", "days": 30 }, { "name": "Harvest", "days": 30 }, { "name": "Leaffall", "days": 30 },
        { "name": "Mistmoot", "days": 30 }, { "name": "Frostmoot", "days": 30 }, { "name": "Longnight", "days": 30 }
      ],
      "weekdays": ["Firstday", "Seconday", "Thirdday", "Fourthday", "Fifthday", "Restday"],
      "eras": [
        { "name": "The Skyward Age", "abbr": "SkA", "start": -900 },
        { "name": "After the Falling", "abbr": "AF", "start": 0 }
      ],
      "moons": [{ "name": "Selune", "cycle": 30, "offset": 3, "color": "#d9cfb8" }],
      "currentYear": 1043
    }
  },
  "articles": [
    {
      "title": "Varenhold",
      "type": "location",
      "summary": "The rain-slick capital of Vael, built on the bones of a Skyward citadel.",
      "fields": { "Type": "Capital city", "Population": "~84,000", "Ruler": "[[Queen Ysolde]]" },
      "date": "1 Greening 312",
      "tags": ["capital", "vael"],
      "body": "## Overview\nVarenhold climbs a granite spur above the [[River Ost]].",
      "secrets": "The floating engine is failing."
    },
    {
      "title": "Queen Ysolde",
      "type": "character",
      "summary": "Sharp-tongued monarch of Vael.",
      "parent": "Varenhold",
      "date": "3 Highsun 1009",
      "fields": { "Species": "Human", "Occupation": "Queen of Vael" },
      "relationships": [
        { "type": "child", "target": "King Aldric" },
        { "type": "rules", "target": "Varenhold" },
        { "type": "rival", "target": "Mother Wick", "note": "an uneasy truce" }
      ],
      "body": "Ysolde took the throne at nineteen after the [[Night of Falling Lanterns]]."
    },
    { "title": "King Aldric", "type": "character", "date": "978", "endDate": "21 Longnight 1028" },
    { "title": "Mother Wick", "type": "character" },
    { "title": "River Ost", "type": "location" },
    { "title": "Night of Falling Lanterns", "type": "event", "date": "21 Longnight 1028" }
  ]
}
```

---

## The world

| Key | Meaning |
|---|---|
| `name` | The world's name. An existing world with the same name is offered as the merge target. |
| `description` | Markdown, shown on the world's overview. |
| `calendar` | Optional. Defaults to an Earth-like calendar. |

### Calendar

| Key | Meaning |
|---|---|
| `months` | `{ "name", "days" }` in order, or the short form `"Frostmoot:30"`. |
| `weekdays` | Weekday names in order. |
| `firstWeekday` | Optional. The weekday of the first day of year 0 (name or 0-based number). |
| `eras` | Optional `{ "name", "abbr", "start", "countFromOne" }`. Each era runs from `start` until the next one, and `abbr` follows the year ("1042 AF"). `countFromOne` numbers years from the era's start. |
| `moons` | Optional `{ "name", "cycle", "offset", "color" }`, with `cycle` in days. |
| `currentYear` | Optional present-day year. |
| `preset` | Optional `"standard"` (Earth-like) or `"even"` (12 × 30 days), filling in any part you leave out. |

---

## Articles

Only `title` is required.

| Key | Meaning |
|---|---|
| `title` | Unique name. Other articles refer to it by this. |
| `type` | One of `character`, `species`, `culture`, `profession`, `title`, `location`, `settlement`, `building`, `organization`, `religion`, `event`, `conflict`, `plot`, `myth`, `spell`, `law` (natural law / magic system), `condition`, `technology`, `item`, `vehicle`, `material`, `tradition`, `language`, `lore`, `article`. Synonyms such as NPC, city, castle, faction, war, quest, legend, disease, ship or festival also work. Anything else becomes `article`. |
| `summary` | A line or two for lists and link previews. |
| `body` | Markdown. Link with `[[Title]]` or `[[Title|shown text]]`. |
| `secrets` | GM notes in Markdown, collapsed when reading. Alias: `gmNotes`. |
| `parent` | Title of the article this belongs to, e.g. a district's city. |
| `tags` | A list, or a comma-separated string. |
| `fields` | Infobox as `{ "Field": "Value" }`. Values can contain `[[links]]`, and any field name works. Alias: `infobox`. |
| `date` | When it happened or began. Alias: `start`. |
| `endDate` | When it ended. Alias: `end`. |
| `dateText` | Optional text shown instead of the date. |
| `relationships` | `{ "type", "target", "note" }`, see below. |
| `image`, `headerImage` | Optional `data:` URL or web address. Some sites block downloads; images can be added in the app instead. |

### Dates

Dates use the world's month names. All of these work:

- `"1042"`, `1042`, `-300`
- `"Frostmoot 1042"`
- `"12 Frostmoot 1042"`, `"Frostmoot 12, 1042"`, `"12th of Frostmoot 1042"`
- `"1042 AF"`, with an era abbreviation (read relative to the era if it uses `countFromOne`)
- `{ "year": 1042, "month": "Frostmoot", "day": 12 }`, where `month` can also be a number from 1

### Relationships

Relationships read from the article's side: on *Queen Ysolde*, `{ "type": "child", "target": "King Aldric" }` means Ysolde is Aldric's child. The reverse is added automatically, so write each relationship once.

| Group | Types |
|---|---|
| Family | `parent`, `child`, `spouse`, `sibling`, `partner` |
| Bonds | `friend`, `ally`, `mentor`, `student` |
| Conflict | `rival`, `enemy` |
| Affiliation | `member`, `hasMember`, `leader`, `ledBy`, `rules`, `ruledBy`, `serves`, `servedBy`, `worships`, `worshippedBy`, `created`, `createdBy`, `owns`, `ownedBy` |
| Other | `locatedIn`, `locationOf`, `related` |

Phrases like "father", "married to", "member of" and "founded by" also work.

---

## Importing again

Importing into an existing world matches articles by title. New titles are created. Existing articles change only in the keys you include, so leaving out `body` keeps the current text. Updates go into revision history and can be undone.

To extend a world with an assistant, export it from **Settings → Import a world**, give the file to the assistant with your new material, and import the reply.

---

## Instructions for an AI assistant

1. Reply with one JSON object in this format. A ```json code block is fine.
2. Use unique titles, and refer to articles by exact title in `[[links]]`, `parent` and `target`.
3. Include `calendar` only if the world has its own, and write dates with its month names.
4. Only use facts from the material. Put uncertainties in `secrets`.
5. Split large topics into several linked articles, each with a short `summary`.
6. Put short facts in `fields` and prose in `body`.
