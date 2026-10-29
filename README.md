# WorldAtlas

A worldbuilding wiki for phone and PC, in the spirit of World Anvil. It works offline and syncs through your own OneDrive.

**Live app:** https://momijisu.github.io/WorldAtlas/

## Features

- Articles from 25 templates (characters, settlements, spells, natural laws, conditions, conflicts, plots and more), each with an infobox grouped into sections, a portrait and a header image
- Live editing: Markdown shown formatted as you type (or plain Markdown, or a preview)
- `[[Wiki links]]` with autocomplete, hover previews, backlinks, and links that update when an article is renamed
- A contents box on articles with several headings
- Typed relationships, family trees and a relationship web
- Custom calendars with eras and moons, a calendar view and a timeline
- Maps with pins, regions, layers and nested maps
- Revision history with line diffs, restore, and recovery of deleted articles
- A writing guide for each template, and 353 writing prompts, some naming your own articles
- GM notes that stay collapsed while reading
- Handwritten passages (`:::cursive` blocks) and your own fonts per world for runes and invented alphabets
- Merge resolver for articles edited on two devices before they synced
- Import from a simple JSON format ([docs/IMPORT_FORMAT.md](docs/IMPORT_FORMAT.md)), e.g. one an AI assistant made from your notes
- Full backup to a single file
- Dark and light themes, a gradient, background patterns or your own wallpaper image for each world, and adjustable fine noise that softens flat colours
- An example world, Aerthal, opens on first visit. It stays on that device and never syncs unless you choose to keep it.

Plain HTML, CSS and JavaScript. No server, no build step.

Planned: a read-only "player view" export without GM notes.

## 1. Hosting

The app must be served over HTTPS to install on a phone. GitHub Pages works:

1. Push to `main`.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. `.github/workflows/pages.yml` deploys every push to `main`, to `https://<user>.github.io/<repo>/`.

Pages on a private repo needs a paid GitHub plan. World data isn't stored in the repo, so a public repo is fine. Netlify or Cloudflare Pages also work.

## 2. OneDrive sync

One-time setup with Microsoft:

1. Sign in at https://entra.microsoft.com with the account whose OneDrive you'll use. If personal accounts are refused, create a free Azure account first (card verification, no charge).
2. **App registrations → New registration**:
   - Supported account types: *any organizational directory and personal Microsoft accounts*
   - Redirect URI: platform **Single-page application**, URL = the app's address with the trailing `/` (Settings shows it with a Copy button)
3. Copy the **Application (client) ID** into `js/config.js` and push. (With no ID there, Settings asks each device for one.)
4. In the app, **Settings → Connect OneDrive**.

The app asks for `Files.ReadWrite.AppFolder`, which only reaches `OneDrive/Apps/WorldAtlas`, and `User.Read` for your name. No other permissions are needed.

For local testing, add `http://localhost:8000/` as a redirect URI and run `python3 -m http.server 8000`.

## 3. Installing

- **Android:** Chrome menu → *Install app*. In Edge: menu → *Add to phone*.
- **iPhone/iPad:** Share → *Add to Home Screen*. Connect OneDrive from inside the installed app; iOS keeps its storage separate from the browser's.
- **PC:** the install icon in the address bar, in Edge or Chrome.

## Syncing

Each device keeps a full copy in IndexedDB. OneDrive holds `atlas.json` (worlds, articles, maps), `history.json` (versions) and `images/`.

Sync runs shortly after each edit, when the app is reopened or comes back online, and every two minutes. Edits to different articles merge. If the same article changes on two devices before they sync, both versions are kept and the article is flagged for the merge resolver.

Microsoft limits browser sign-ins to 24 hours. The app renews in the background before then, in a hidden frame, so nothing interrupts you. Browsers that block third-party sign-in cookies (such as Safari) can't renew this way; there the sync badge shows **Reconnect**, and one tap signs you straight back in.

## Project layout

```
index.html            app shell
css/app.css           design system and both themes
css/features.css      timeline, calendar, history, prompts, import
css/maps.css          maps
css/graph.css         family tree and relationship web
js/app.js             boot, routing, top bar, sidebar
js/views/*.js         one module per screen
js/store.js           data, templates, version history, conflict merge
js/sync.js            OneDrive sync
js/auth.js            Microsoft sign-in (auth code + PKCE)
js/calendar.js        calendar maths and date formatting
js/relations.js       relationship types and family links
js/prompts.js         writing prompts
js/guidance.js        writing guide questions
js/backgrounds.js     background patterns and wallpaper
js/templates.js       article templates and their infobox sections
js/importer.js        import/export format
js/mapview.js         map pan/zoom, pins and regions
js/markdown.js        Markdown and [[link]] rendering
js/preview.js         hover previews for article links
js/scripts.js         handwriting and world fonts (:::Name blocks, {{Name|text}})
js/icons.js           Phosphor icons (MIT)
js/config.js          Microsoft client ID
js/version.js         app version
sw.js                 service worker
fonts/                Cormorant Garamond, Alegreya, Alegreya Sans, Cedarville Cursive, Kalam (OFL)
vendor/               marked, DOMPurify, live-editor.js (CodeMirror 6, MIT; rebuild with tools/live-editor/build.sh)
```

## Releasing

Bump `WA_VERSION` and `WA_BUILD` in `js/version.js`. Installed apps pick up the new version and replace their offline cache. Settings → About shows the running and latest versions. When adding or removing files, update `SHELL` in `sw.js`.
