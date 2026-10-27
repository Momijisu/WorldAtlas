# WorldAtlas import format

A simple JSON format for bringing a world into [WorldAtlas](https://momijisu.github.io/WorldAtlas/). It is designed to be easy to write by hand or to generate with an AI assistant from notes, documents or another worldbuilding tool.

Everything is linked by **title**: you never need IDs. The app shows a preview before saving anything, and lists anything it couldn't match.

**To import:** open WorldAtlas, go to **Settings → Import a world**, then choose **Import from file** or **Paste text**.

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
| `name` | The world's name. When importing, the app suggests merging into an existing world with the same name. |
| `description` | Markdown, shown on the world's overview. `[[Links]]` work here too. |
| `calendar` | Optional. Leave it out to use an Earth-like calendar. |

### Calendar

| Key | Meaning |
|---|---|
| `months` | List of `{ "name", "days" }` in order. The short form `"Frostmoot:30"` also works. |
| `weekdays` | List of weekday names in order. |
| `firstWeekday` | Optional: which weekday the first day of year 0 falls on (a name or 0-based number). |
| `eras` | Optional list of `{ "name", "abbr", "start", "countFromOne" }`. An era applies from its `start` year until the next era begins, and its `abbr` is shown after years ("1042 AF"). With `countFromOne: true`, years are numbered from the start of the era. |
| `moons` | Optional list of `{ "name", "cycle", "offset", "color" }`. `cycle` is in days. |
| `currentYear` | Optional "present day" year, used by the calendar and timeline. |
| `preset` | Optional: `"standard"` (Earth-like) or `"even"` (12 × 30 days), used for any part you leave out. |

---

## Articles

Only `title` is required.

| Key | Meaning |
|---|---|
| `title` | Unique name of the article. Other articles refer to it by this title. |
| `type` | Template, one of `character`, `location`, `organization`, `species`, `item`, `event`, `religion`, `culture`, `lore`, `article`. Common synonyms work too: person, NPC, place, city, region, faction, guild, house, race, creature, artifact, weapon, battle, war, deity, god, myth, legend, language, magic and more. Anything unrecognised becomes a generic article. |
| `summary` | One or two lines, shown in lists and link previews. |
| `body` | The article itself, in Markdown. Link other articles with `[[Title]]` or `[[Title|shown text]]`. Links to titles that don't exist yet show in red, ready to be written. |
| `secrets` | GM-only notes (Markdown), hidden until opened. Alias: `gmNotes`. |
| `parent` | Title of the article this one belongs to, e.g. a district's city. |
| `tags` | List of tags, or a comma-separated string. |
| `fields` | Infobox fields as `{ "Field": "Value" }`. Values may contain `[[links]]`. Each template has default fields; for a character those are Full name, Species, Age, Born, Died, Occupation, Affiliation and Residence. You can add any others. Alias: `infobox`. |
| `date` | When it happened or began; places it on the timeline and calendar. Alias: `start`. |
| `endDate` | When it ended (lifespans, reigns, wars). Alias: `end`. |
| `dateText` | Optional text shown instead of the formatted date, e.g. "The Long Winter". |
| `relationships` | List of `{ "type", "target", "note" }`, see below. |
| `image`, `headerImage` | Optional image as a `data:` URL or a web address. Web images may fail to download if the site blocks it; you can always add images in the app. |

### Dates

Use the world's month names. All of these work:

- `"1042"`, `1042`, `-300` (a year on its own; negative years are fine)
- `"Frostmoot 1042"`
- `"12 Frostmoot 1042"`, `"Frostmoot 12, 1042"`, `"12th of Frostmoot 1042"`
- `"1042 AF"`: an era abbreviation after the year. For eras with `countFromOne`, the year is read as counted from the start of that era.
- `{ "year": 1042, "month": "Frostmoot", "day": 12 }`. `month` may also be a number from 1.

### Relationships

Relationships are written from the article's point of view: on *Queen Ysolde*, `{ "type": "child", "target": "King Aldric" }` means *Ysolde is the child of Aldric*. The other side is filled in automatically, so you only need to write each relationship once.

| Group | Types |
|---|---|
| Family | `parent`, `child`, `spouse`, `sibling`, `partner` |
| Bonds | `friend`, `ally`, `mentor`, `student` |
| Conflict | `rival`, `enemy` |
| Affiliation | `member`, `hasMember`, `leader`, `ledBy`, `rules`, `ruledBy`, `serves`, `servedBy`, `worships`, `worshippedBy`, `created`, `createdBy`, `owns`, `ownedBy` |
| Other | `related` |

Plain phrases such as "father", "married to", "brother", "member of", "led by" and "founded by" are also understood. Family relationships build the family tree; all of them appear in the relationship web.

---

## Importing again

Importing into an existing world **matches articles by title**:

- New titles are created.
- Existing articles are updated, but only the keys you include change. Leave out `body` and the existing text is kept.
- Unchanged articles are skipped.
- Every update is saved in the article's revision history, so it can be undone.

The usual round trip is:

1. Export a world in this format from **Settings → Import a world → Export a world in this format**.
2. Give it to an assistant with your changes ("add the noble houses from this document").
3. Import the result.

---

## Instructions for an AI assistant

When converting someone's material:

1. Reply with **one JSON object** in this format. Wrapping it in a ```json code block is fine.
2. Use exact, unique titles, and refer to other articles by those titles in `[[links]]`, `parent` and relationship `target`s.
3. Include a `calendar` only if the world has its own calendar, and write dates with its month names.
4. Only include facts present in the material. Don't invent details; note uncertainties in `secrets`.
5. Prefer several linked articles over one huge article. Give each a short `summary`.
6. Put structured facts (species, population, ruler, founded…) in `fields`, and prose in `body`.
