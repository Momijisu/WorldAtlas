# Development

WorldAtlas is plain HTML, CSS and JavaScript (ES modules): no framework and no build step. Edit a file, reload the page.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Project layout

```
index.html            app shell
css/app.css           design system and both themes
css/features.css      timeline, calendar, history, prompts, import
css/maps.css          maps
css/graph.css         family trees, organisation charts and the relationship web
js/app.js             boot, routing, top bar, sidebar
js/views/*.js         one module per screen
js/store.js           data, version history, conflict merge
js/sync.js            sync: the shared logic, and the OneDrive provider
js/syncfolder.js      folder sync provider (a folder another app keeps in step)
js/auth.js            Microsoft sign-in (auth code + PKCE)
js/calendar.js        calendar maths and date formatting
js/relations.js       relationship types and family links
js/duplicates.js      finding and merging duplicate articles
js/statblocks.js      statblocks in the text: parsing, layout, rolls, the statblock form
js/tables.js          tables in the text: reading tools, dice, rolling, CSV, the table editor
js/edges.js           header image edges (fade, torn, mist, hard cut)
js/picker.js          type-to-search article fields
js/prompts.js         writing prompts
js/guidance.js        writing guide questions
js/backgrounds.js     background patterns and wallpaper
js/templates.js       article templates and their infobox sections
js/importer.js        import/export format (text, for AI assistants)
js/worldfile.js       .world files: a whole world in one zip archive
js/mapview.js         map pan/zoom, pins, regions and measuring
js/markdown.js        Markdown, [[links]], excerpts and callouts
js/preview.js         hover previews for article links
js/scripts.js         handwriting and world fonts (:::Name blocks, {{Name|text}})
js/contextmenu.js     the right-click menu
js/icons.js           Phosphor icons (MIT)
js/config.js          Microsoft client ID (see docs/SYNC.md)
js/version.js         app version
js/updates.js         what's new in a waiting update, and the Update ready window
sw.js                 service worker (offline cache)
fonts/                Cormorant Garamond, Alegreya, Alegreya Sans, Cedarville Cursive, Kalam (OFL)
vendor/               marked, DOMPurify, live-editor.js (CodeMirror 6, MIT; rebuild with tools/live-editor/build.sh)
tests/                browser tests
```

## Tests

`tests/run.sh` runs the browser tests. It needs Node with Playwright and Chromium, and serves the app on port 8766 if nothing is running there already.

`tests/run.sh maps` runs only the tests whose names contain "maps". A failing test exits non-zero and names what broke.

What they cover:
- every main page opening (`smoke`);
- OneDrive sync end to end against a fake drive (`sync`): migration, a second device, merging, rename, delete, old-version files, throttling, retries, and one stuck world not blocking the others;
- folder sync through a synced folder: a second device, merging, conflicted copies, pictures, renaming (`folder-sync`);
- the offline cache and updates: a new version waits for the user, with its notes (`offline`);
- backup files between devices, with clashes sent to the merge manager (`backup`);
- articles: links, excerpts and prompts (`articles`), callouts and aliases (`callouts-aliases`);
- the editor: its toolbar and link previews while editing (`editor`), headings written without a space (`headings`), the article pickers (`picker`);
- finding and merging duplicates (`duplicates`);
- maps: the map key (`maps-key`), region shapes and names (`maps-regions`), panning and place names (`maps-input`), marker styles (`markers`), measuring distances, setting the scale from a distance or a travel time, and the scale bar (`maps-measure`);
- family trees and organisation charts (`trees`);
- tables in an article's text: the Table button, pasting, search, sort, rolling by die and chance, dice, checkboxes, quoting, 1.56 tables (`tables`);
- app-wide and per-world appearance, and moving old device defaults into worlds (`appearance`);
- statblocks: drawing, modifiers and saves, rolls, the Statblock button (`statblocks`);
- .world files: exporting, opening on another device, merging with clashes (`worldfile`);
- pictures: zooming a portrait, and saving or copying one from the right-click menu (`images`);
- the right-click menu (`contextmenu`).

The tests draw their own test map (`tests/lib.js`).

## Releasing

1. Run `tests/run.sh`.
2. Bump `WA_VERSION` (and `WA_BUILD`) in `js/version.js`, and add a `## x.y.z` section at the top of `CHANGELOG.md`: installed apps show it as *What's new* when they offer the update, which waits until the user chooses it.
3. When adding or removing files, update `SHELL` in `sw.js` so they're available offline.

`.github/workflows/pages.yml` publishes every push to `main` to GitHub Pages.
