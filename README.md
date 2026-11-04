# WorldAtlas

**A worldbuilding wiki for your campaigns and stories, on your phone and your PC.**
Write articles about your world's people, places and history, link them together, and pin them on your maps. It works offline, needs no account, and keeps your world on your own devices.

**[Open WorldAtlas →](https://momijisu.github.io/WorldAtlas/)** It opens with an example world, Aerthal, to explore.

![An article in WorldAtlas: the city of Varenhold, with its contents, infobox and header image](docs/screenshots/article.jpg)

## Features

**Write**
- Articles from 25 templates (characters, settlements, organisations, spells, conflicts, plots and more), each with an infobox, a portrait and a header image
- An editor that shows Markdown formatted as you type
- Callouts for notes, tips and warnings, and GM notes that stay folded away while you read
- A writing guide for each template and 353 writing prompts, some about your own articles
- Handwritten passages, and your own fonts for runes and invented alphabets

**Connect**
- `[[Links]]` between articles, with suggestions as you type, previews on hover and backlinks, which update when you rename an article
- Other names for an article ("The Iron Queen"), so links to any of them land in the right place
- Excerpts: show part of one article inside another, kept up to date
- Relationships between articles, drawn as a relationship web, family trees and organisation charts
- A tidy-up page that finds duplicate articles and merges them

**Map**
- Maps with pins, regions, layers and maps nested inside maps
- Numbered pins with a map key you can arrange into groups, in several marker styles
- Distances and travel times on foot, on horseback or by ship, and a scale bar

**Keep track of time**
- Your own calendars with eras and moons, a calendar view and a timeline

**Keep your work safe**
- Version history for every article, and recovery of deleted ones
- Optional sync between your devices through your own OneDrive
- Import from a simple format (handy for turning existing notes into a world with an AI assistant) and full backups to a single file

| | | |
|---|---|---|
| ![A map of the kingdom of Vael with pins and layers](docs/screenshots/map.jpg) | ![A family tree](docs/screenshots/family-tree.jpg) | ![The relationship web](docs/screenshots/relationships.jpg) |

## Getting started

There are three ways to use WorldAtlas. All of them are free.

### 1. Use it online

Open **https://momijisu.github.io/WorldAtlas/** in any modern browser. Nothing to sign up for. Your worlds are saved in that browser on that device.

To use it like an app, install it from the browser. It then opens in its own window and works with no internet connection:

- **Windows, Mac, Linux:** the install icon in the address bar (Chrome or Edge)
- **Android:** browser menu → *Install app* (Chrome) or *Add to phone* (Edge)
- **iPhone / iPad:** Share → *Add to Home Screen*

### 2. Run it on your own computer

WorldAtlas is plain HTML, CSS and JavaScript: no server code, no database, nothing to build. Download it and serve the folder with any small web server:

```sh
git clone https://github.com/Momijisu/WorldAtlas.git
cd WorldAtlas
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also use `npx serve`, or the Live Server extension in VS Code.

Opening `index.html` by double-clicking it doesn't work, because browsers block web apps that load from files on disk, so a small server is needed. Once it's open you can install it from the browser (see above) and use it fully offline.

### 3. Host your own copy

Put the folder on any static web host: GitHub Pages, Netlify, Cloudflare Pages or your own web server. To install it on a phone, the host needs HTTPS, which all of these provide.

**On GitHub:** fork this repository, then in your fork go to **Settings → Pages** and set **Source** to **GitHub Actions**. Every push to `main` then publishes to `https://<your-name>.github.io/WorldAtlas/`.

## Syncing between devices (optional)

Without sync, each device keeps its own worlds. To have the same worlds on your phone and your PC, go to **Settings → OneDrive sync** and choose **Connect OneDrive**:

- WorldAtlas only gets access to its own folder, `OneDrive/Apps/WorldAtlas`, and nothing else in your OneDrive.
- Edits merge between devices. If the same article changes on two devices before they sync, you choose what to keep.

On the online version this works straight away. A copy you run or host yourself needs a free one-time registration with Microsoft first: see [docs/SYNC.md](docs/SYNC.md).

## Your data

- **No account and no tracking.** WorldAtlas has no server of its own. Your worlds live in your browser, and in your OneDrive if you turn sync on.
- **You can always take it with you:** export a world, or back everything up to a single file, from Settings.
- **Browsers can clear website data.** If you don't use sync, make a backup now and then.

## More

- [Import format](docs/IMPORT_FORMAT.md): bring an existing world in, or have an AI assistant convert your notes
- [Syncing in detail](docs/SYNC.md): setting up OneDrive for your own copy, and how syncing works
- [Development](docs/DEVELOPMENT.md): project layout, tests and releasing

## Credits

Fonts: Cormorant Garamond, Alegreya, Alegreya Sans, Cedarville Cursive and Kalam, under the SIL Open Font License. Icons: [Phosphor](https://phosphoricons.com) (MIT). Libraries: [marked](https://marked.js.org), [DOMPurify](https://github.com/cure53/DOMPurify) and [CodeMirror](https://codemirror.net).
