# WorldAtlas

A personal worldbuilding wiki, inspired by World Anvil, that runs on your phone and your PC and syncs through **your own OneDrive**.

- **Articles from templates**: Characters, Locations, Organizations, Species, Items, Events, Religions, Cultures, Lore, plus a generic Article. Each has an infobox with template fields, and you can add your own fields.
- **Header image and portrait**: a wide header image fades in behind the article title, and a separate portrait sits in the infobox.
- **Wiki links**: type `[[` to link another article. Links to articles that don't exist yet show in red, and tapping one creates that article. Renaming an article updates every link to it. Each article lists the articles that mention it.
- **Relationships**: typed links between articles (parent of, spouse of, ally of, rival of, member of, rules, and more). The other article shows the inverse automatically.
- **Family trees**: three generations up and down, with spouses and siblings, built from relationships.
- **Relationship web**: an interactive force-directed graph with filters, focus on one article, and optional wiki-link edges.
- **Custom calendars**: your own months and lengths, weekdays, eras (optionally counting from 1) and moons with phases. Articles take full dates, which are shown in your calendar's format.
- **Calendar view**: month and year views of dated events, with moon phases. Tap a day to record an event on it.
- **Timeline**: a chronicle grouped by era, plus a zoomable span chart for lifespans, reigns and wars, with filters by type and tag.
- **Maps**: pins with icons and colours, drawn regions, layers you can show and hide, nested maps (a pin can open another map), and place search.
- **Revision history**: every save keeps a version (the last 40 per article). Compare versions line by line, restore any of them, and recover deleted articles.
- **Writing guide**: each template has guiding questions in the editor (appearance, motivation, history, secrets…). Tap one to add that section to the article; covered sections are ticked off.
- **Writing prompts**: 353 original prompts in ten categories. 73 of them are tailored to your world ("What does Queen Ysolde fear most?"). Each world's overview shows a daily prompt. Answer a prompt with a new article or add to an existing one, set aside prompts you don't want, and add your own. You can hide prompts or the writing guide in Settings.
- **GM notes**: a secrets section that stays collapsed while you read.
- **Two themes**: Nocturne (dark) and Vellum (light parchment).
- **Works offline and installs as an app.** Everything saves on the device first and syncs to OneDrive when you're online.
- **Backup**: export everything, images and history included, to one JSON file, and import it again later.

**Roadmap:** read-only shareable export (a "player view" with GM notes removed).

There's no server and no build step. It's plain HTML, CSS and JavaScript, so any static host works.

---

## 1. Put it online (GitHub Pages)

To install it on a phone, the app has to be served over HTTPS. GitHub Pages does this for free:

1. Merge this code into the `main` branch.
2. In the repository, open **Settings → Pages** and under **Build and deployment → Source** choose **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) deploys on every push to `main`. Your app will be at
   `https://<your-github-username>.github.io/<RepoName>/` (for example `https://momijisu.github.io/WorldAtlas/`).

> GitHub Pages on a **private** repo needs a paid GitHub plan. If yours is private and on the free plan, either make the repo public (your world data is **not** stored in the repo; it lives in OneDrive) or use another static host such as Netlify, Cloudflare Pages or Azure Static Web Apps.

## 2. Set up OneDrive sync (one time, about 5 minutes)

Microsoft only lets an app use OneDrive if the app is registered with them. The registration is free, and you only do it once.

1. Go to **https://entra.microsoft.com** (or portal.azure.com → *Microsoft Entra ID*) and sign in with the Microsoft account whose OneDrive you want to use.
   - If it says your personal account can't register apps without a directory, create a free Azure account at https://azure.microsoft.com/free. It asks for card verification, but app registrations cost nothing.
2. Go to **Applications → App registrations → New registration**.
   - **Name**: `WorldAtlas`
   - **Supported account types**: *Accounts in any organizational directory and personal Microsoft accounts*
   - **Redirect URI**: choose platform **Single-page application (SPA)** and enter your app's exact URL from step 1, including the trailing `/`, e.g. `https://momijisu.github.io/WorldAtlas/`.
     The app's **Settings** page shows this exact value with a Copy button.
3. Click **Register**, then copy the **Application (client) ID**.
4. Give the app the client ID, using either option:
   - **Recommended:** put it in `js/config.js` (`export const CLIENT_ID = '…'`), then commit and push. Every device picks it up.
   - Or paste it into **Settings → Microsoft app registration** on each device.
5. In the app, open **Settings → Connect OneDrive** and sign in.

You don't need to add API permissions by hand. At sign-in the app asks for `Files.ReadWrite.AppFolder` (access to **its own folder only**, `OneDrive/Apps/WorldAtlas`, not the rest of your files) and `User.Read` (to show your name).

To test locally, also add `http://localhost:8000/` as an SPA redirect URI and run `python3 -m http.server 8000` in this folder.

## 3. Install on your devices

- **Android (Chrome)**: open the site, then menu ⋮ → **Install app** (or *Add to Home screen*).
- **iPhone/iPad**: open the site **in Safari**, then Share → **Add to Home Screen**. Connect OneDrive *from inside the installed app*, because iOS keeps the app's storage separate from Safari's.
- **Windows/Mac (Edge or Chrome)**: click the install icon at the right end of the address bar, or menu → *Apps → Install WorldAtlas*. It then opens in its own window and appears in the Start menu.

## How syncing works

- Each device keeps a full copy in its browser storage (IndexedDB), so the app is fast and works offline.
- In OneDrive, `Apps/WorldAtlas/atlas.json` holds all the text (worlds, articles, maps), `history.json` holds article versions, and `images/` holds the pictures.
- Sync runs a couple of seconds after each edit, when the app comes back to the foreground, when the network returns, and every 2 minutes while the app is open. The cloud icon in the top bar shows the status; tap it to sync now.
- **Conflicts are merged per article.** If you edit *different* articles on your phone and PC, both edits survive. If you edit the *same* article on both before they sync, the most recent save wins. Deletions sync too.
- Microsoft limits browser-app sign-ins to 24 hours. The app renews the sign-in automatically when you open it. If that ever fails, the badge shows **Reconnect** and one tap fixes it. Your changes stay safe on the device in the meantime.

## Project layout

```
index.html            app shell
css/app.css           design system (tokens, type, components, both themes)
css/features.css      timeline, calendar, history, article header
css/maps.css          map viewer
css/graph.css         family tree and relationship web
js/app.js             boot, routing, top bar, sidebar
js/views/*.js         one module per screen
js/store.js           data in memory and IndexedDB, templates, version history
js/sync.js            OneDrive two-way sync
js/auth.js            Microsoft sign-in (OAuth 2.0 auth-code + PKCE, no library)
js/calendar.js        custom calendar maths and date formatting
js/relations.js       relationship types and inverses, family links
js/prompts.js         writing prompt library and daily prompt
js/guidance.js        guiding questions per template
js/mapview.js         pan/zoom map viewer with pins and regions
js/markdown.js        Markdown + [[wiki link]] rendering
js/icons.js           icon set (Phosphor, MIT)
js/config.js          your Azure client ID
sw.js                 service worker (offline cache)
fonts/                Cormorant Garamond, Alegreya, Alegreya Sans (SIL OFL)
vendor/               marked (Markdown), DOMPurify (sanitising)
```

When you add or remove files, update the list in `sw.js` and bump its `VERSION`. Edits to existing files are picked up automatically on the next launch after the one that downloads them.
