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
js/sync.js            OneDrive sync
js/auth.js            Microsoft sign-in (auth code + PKCE)
js/calendar.js        calendar maths and date formatting
js/relations.js       relationship types and family links
js/duplicates.js      finding and merging duplicate articles
js/picker.js          type-to-search article fields
js/prompts.js         writing prompts
js/guidance.js        writing guide questions
js/backgrounds.js     background patterns and wallpaper
js/templates.js       article templates and their infobox sections
js/importer.js        import/export format
js/mapview.js         map pan/zoom, pins, regions and measuring
js/markdown.js        Markdown, [[links]], excerpts and callouts
js/preview.js         hover previews for article links
js/scripts.js         handwriting and world fonts (:::Name blocks, {{Name|text}})
js/contextmenu.js     the right-click menu
js/icons.js           Phosphor icons (MIT)
js/config.js          Microsoft client ID (see docs/SYNC.md)
js/version.js         app version
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
- the offline cache and updates (`offline`);
- articles: links, excerpts and prompts (`articles`), callouts and aliases (`callouts-aliases`);
- the editor: its toolbar (`editor`), headings written without a space (`headings`), the article pickers (`picker`);
- finding and merging duplicates (`duplicates`);
- maps: the map key (`maps-key`), region shapes and names (`maps-regions`), panning and place names (`maps-input`), marker styles (`markers`), measuring distances and the scale bar (`maps-measure`);
- family trees and organisation charts (`trees`);
- the right-click menu (`contextmenu`).

The tests draw their own test map (`tests/lib.js`).

## Releasing

1. Run `tests/run.sh`.
2. Bump `WA_VERSION` (and `WA_BUILD`) in `js/version.js`. Installed apps pick up the new version and replace their offline cache; Settings → About shows the running and latest versions.
3. When adding or removing files, update `SHELL` in `sw.js` so they're available offline.

`.github/workflows/pages.yml` publishes every push to `main` to GitHub Pages.
