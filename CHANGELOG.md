# What's new

## 1.70.0

- **The overview as a title page:** the world's name is centred in small capitals over a ruled line, with an optional **Subtitle** (new in World settings) beneath it. The overview's **Contents** now follow the description as a list with dotted leaders to the counts; with writing prompts turned off, **Read a random article** sits under them.
- **Articles read like a book:** a running head across the top (Aerthal · Vael · Varenhold) replaces the breadcrumb, and titles are set in small capitals.
- **Infobox style, per world:** World settings → **Article infoboxes**: **Boxed** (as before) or **Margin**, which drops the box for a gilt rule down its left side.
- **Map display, per map:** Map settings has a new **Display** section. **Fit the window to the map** sizes the map's window to the map's own shape; untick **Grid behind the map** for a plain background around it; **Frame** puts a gilt frame with corner ornaments round it; and **Grid over the map** lays squares or hexes over it, sized in the map's pixels. Changes preview on the map as you make them.
- **Less explanation, more room:** helper text across Settings, World settings, the editor and dialogs is cut back to what you actually need: what happens to your data, and anything you couldn't guess.

## 1.69.0 · 11 November 2026

- **Click a picture to see it large:** portraits, header images, the world cover and pictures in an article open over the page, whole and uncropped, with the article's name. Esc, a click outside or ✕ closes it; right-click it to save or copy.

## 1.68.2 · 11 November 2026

- **Tighter spacing above headings in articles.** Space above a heading no longer grows with its size, which left a large gap above `#` headings; `#` headings inside an article are also a step smaller than the article's title.

## 1.68.1 · 11 November 2026

- **The ! shows as soon as an update lands.** The app now checks for a new version shortly after opening, every ten minutes and whenever you come back to it, and shows the **!** straight away while the update downloads in the background. Before, the **!** could lag behind Settings → About by up to half an hour.

## 1.68.0 · 11 November 2026

- **Arrange the whole sidebar:** the Arrange button (on each section's heading) now covers **Chronicle** (Timeline, Calendar) and **Atlas** (Maps, Relationships) too: untick what you don't use. A section with nothing left disappears, and the overview follows.
- **Zoom the world card:** World settings has a **Zoom** slider for the card on the worlds page, alongside its own framing.
- **What's new stays readable:** after updating, Settings → About this app keeps this version's notes, folded, to read any time.
- **Fix:** **Update now** clicked before the new version had finished downloading could sit on "Updating…" and reload into the old version. It now waits for the download, then updates.

## 1.67.0 · 11 November 2026

- **Arrange the codex:** the new button beside **Codex** in the sidebar lets you choose which templates show (all, to begin with) and drag them into the order you like. The overview follows it too. It's saved with the world, so it syncs; hidden templates' articles are still in All articles and search. **Show all, usual order** puts it back.
- **Zoom and frame the world cover:** World settings has a **Zoom** slider for the cover, shown on the world's overview.

## 1.66.0 · 11 November 2026

- **Zoom and frame header images** too: the editor's header image has a **Zoom** slider like the portrait's. Drag to frame it, zoom to crop in.
- **Zoomed pictures move both ways:** a zoomed portrait or header can now be dragged up and down as well as across (before, only the direction the picture already overflowed).

## 1.65.1 · 10 November 2026

- **Portraits are always square** in the infobox, framed as you set them in the editor, even when the picture is tall or wide.

## 1.65.0 · 10 November 2026

- **Zoom and frame a portrait:** in the editor, drag the portrait to frame it and use the new **Zoom** slider to crop in. Zoomed, the infobox shows your square crop; at 100% it shows the whole picture, as before.
- **Save or copy any picture:** right-click a portrait, header image or world cover for **Save image as…**, **Copy image** and **Open image in new tab**. Saved pictures are named after their article or world.

## 1.64.1 · 10 November 2026

- Settings → Files: **Export a world** (was *Save a world*), to match **Export .world** in World settings.

## 1.64.0 · 10 November 2026

### .world files
- **Export a whole world as one file:** its articles, maps, version history and every picture, in a single **.world** file. Settings → Files → **Export a world**, or **Export .world** in World settings.
- **Open a .world file** to add the world on another device, or to share it. Opening a world you already have merges it in: newer work is kept, and an article changed in both places goes to the merge manager.
- With the installed app in Chrome or Edge, double-click a .world file to open it in WorldAtlas.
- **Settings is tidier:** a **Files** panel (save a world, back up everything, and one **Open a file** that recognises a .world, a backup or an import file) and an **AI assistant** panel for turning notes into articles.

### Sync through a folder
- **Point WorldAtlas to a folder on your PC** and use any cloud storage you like to keep it in step between your computers: **Settings → Sync → Custom folder → Choose folder**. WorldAtlas only reads and writes the folder, and never sees your cloud account.
- Merges like OneDrive sync: edits to different articles combine, and an article changed on two computers goes to the merge manager, including when the folder app has kept a "conflicted copy".
- **One Sync panel:** Settings → Sync lets you choose how to sync (OneDrive or a custom folder) and shows the setup for that one. A device uses one at a time; choosing the other offers to switch.
- Chrome and Edge on a computer. See [docs/SYNC.md](docs/SYNC.md#syncing-through-a-folder).

### Fixes
- Opening an import file or backup whose articles contain statblocks (or other ``` blocks) now reads the whole file, rather than just one block.

### Updates
- **No pop-up when an update arrives.** The **!** on Settings & sync is all you'll see; *What's new* and **Update now** are in Settings → About this app.

## 1.63.2 · 10 November 2026

- **Taller header images** on articles: up to 520px on wide screens (was 420px), so more of the picture shows.
- **Firefox:** Settings → Install the app now gives the right steps. On Android, menu → *Add app to Home screen*. On a computer, where Firefox can't install web apps, it says so, and that WorldAtlas works fully in a tab.

## 1.63.1 · 10 November 2026

- **Statblock entries are spaced apart:** each line in a section (*Multiattack*, *Bite*, *Tail*…) is its own paragraph, even without a blank line between them.
- **Rolls keep their brackets:** "(4d12 + 7)" no longer splits across two lines.
- **Empty statblock sections** (such as an unfilled *Traits*) are no longer shown.

## 1.63.0 · 10 November 2026

### Updates are yours to choose
- **Nothing updates by itself any more.** When a new version is ready, a **!** appears on **Settings & sync**, and the app keeps running as it is until you choose **Update now**.
- **See what's in it first:** a small *Update ready* window shows what's new, with **Update now** or **Later**. It won't interrupt you while you're editing; the **!** waits instead.
- **What's new** is also in Settings → About this app, as a section you can open, for as long as the update waits.

(This version still arrives the old way, by itself. From here on, updates wait for you.)

## 1.62.1 · 10 November 2026

- **Statblocks show CR at the top right**, on the same line as the name.

## 1.62.0 · 10 November 2026

### A richer example world
The example world, Aerthal, now shows off more of what WorldAtlas can do:
- **The Sinking Lift** (a quest) has callouts and a checklist of leads you can tick off.
- **The Lantern Guild** sells rumours from a table you can roll on, rarer ones less likely.
- **Mother Wick** and the **Mistfox** have statblocks; hover a link to either for their stats.
- **Queen Ysolde** goes by *The Iron Queen* too, and has a letter in her own hand.
- **Night of Lanterns** quotes the event it remembers.
- **The map** has a scale, so Measure gives distances and travel times, and numbered pins with a key.
- Aerthal uses its own header edge (Torn) and background (Spell circles).

To see it on a device that already has Aerthal, remove the example from its overview and open it again from the worlds page.

### Also
- **Checklists don't get a Roll button** (tables with tickboxes), unless they're named after a die or have a Chance column.
- **Statblocks in link previews:** hover a link to an article with a statblock (a species, a character, a monster) and the preview shows its AC, HP, speed, CR and abilities at a glance.

## 1.61.0 · 10 November 2026

### Statblocks
- **Add a statblock to any article** with the new **Statblock** button on the editor's toolbar: armour, hit points, speed, the six abilities (modifiers worked out for you), saves, skills, senses, languages, challenge, and sections such as Traits and Actions.
- **Laid out like the books:** core stats on the left, sections on the right, in the theme's colours.
- **Rolls in the text roll:** click "2d8 + 4" or "1d6 + 1" to roll it.
- It lives in the article's text (as a ```` ```statblock ```` block), so it syncs, keeps history and merges like everything else; `[[links]]` inside count as links. The example world's **Mistfox** has one. See [docs/STATBLOCKS.md](docs/STATBLOCKS.md).

### Editor
- **Hover a [[link]] while editing** (in Live view) to see the same preview as on the article, so you can check you picked the right one.

### Fixes
- **Header image preview matches the article again.** Since headers went full width, the editor's preview was cropped to the old, narrower shape, so the article showed a different part of the picture.

## 1.60.0 · 5 November 2026

- **Taller world cards** on the worlds page.
- **Frame the card separately:** in World settings, drag the picture in the *On the worlds page* card to choose what shows there, without moving the header. *Same as the header* puts it back.

## 1.59.0 · 5 November 2026

### Updates wait for you
- **No more updates in the middle of your writing.** If a new version arrives while you're editing, a small **!** appears on **Settings & sync** in the sidebar (and on the menu button on phones) instead. Finish and save, then choose **Update now** in Settings → About this app when you're ready. When you're not editing, updates still happen by themselves.

### Setting a map's scale
- **See the travel times as you type:** the scale dialog shows how long the distance takes on foot, on horseback and by ship, so you can tell straight away if it feels right.
- **Or start from a travel time:** choose *I know how long it takes*, enter something like "3 days on horseback", and it works out the distance for you.

### Timeline
- **Era names** now run the full width of the events, between two rules with small diamonds, like the page dividers.

### Sidebar
- When the sidebar is folded, the world's initial takes you to its overview, so the separate Overview icon is hidden there.

## 1.58.0 · 5 November 2026

### Settings, tidied
- **One place for each setting.** In **Settings**: light or dark, Article text and header images behind list rows (how *you* like to read). In each world's **World settings**: its background, noise and header edge (how *that world* looks).
- **Pages outside a world** (your worlds, Settings) always use the app's own gradient. A world that hasn't chosen a background uses it too.
- **Noise** is now part of each world's look, next to its background.
- **Nothing changes on screen:** a background, noise or header edge you'd set as this device's default is copied into each world that hadn't chosen its own.
- **Settings opens with About this app** (version and updates), then Install the app, then OneDrive sync.
- The world settings button in the sidebar lines up with the fold button.
- The **Torn** header edge is touched up.

## 1.57.0 · 5 November 2026

### Tables, now inside articles
- **Add a table anywhere in an article** with the new **Table** button on the editor's toolbar. A grid opens to fill in; the table is written into the article's text. Put the cursor in a table and press **Table** again to change it.
- **Roll like a printed table:** name the first column after a die (`d8`, `d20`…) and fill it with numbers or ranges (`1–2`, `3`), and **Roll** rolls that die and lands on the matching row. A **Chance** column still weights rows instead.
- **Cells work out what they hold:** a roll like `2d6` gets a dice button, `[ ]` and `[x]` become checkboxes you can tick on the page, and a column of numbers lines up and sorts by value.
- **Show a table elsewhere** by quoting its section: `![[Vael#On the road]]`.
- **The Table template is gone.** Tables made with it in 1.56 have moved into their article's text, with links, ticks and chances kept.
- Vael's road encounters in the example world are now a d8 table in the Vael article. See [docs/TABLES.md](docs/TABLES.md).

### Header images
- The **Torn** edge repeats seamlessly on wide screens.

### Fixes
- **Article text → Weight → Medium** now looks heavier than Regular (it was showing Regular).
- The **Edit** button on articles matches the other main buttons.
- The editor's header no longer covers your background with a dark block. It only gets a backing once it sticks to the top while you scroll.
- **Pictures behind list rows** use only header images. An article with just a portrait no longer shows it behind its row (it's already the row's thumbnail).

## 1.56.0 · 4 November 2026

### Tables
- **A new Table template** for anything in rows and columns: random encounters, price lists, rosters, rumours, quest checklists. A table is an article like any other, so it syncs, keeps version history, can be linked to and searched, and goes to Recently deleted if you delete it.
- **Column types:** Text, Long text, Number, Checkbox, Article, Web link, Dice and Chance.
- **Roll on a table:** the Roll button picks a random row, highlights it and rolls any dice in it. A **Chance** column makes some rows more likely than others (0 means never).
- **Dice cells** such as `2d6+1`, `d20` or `d%` roll when clicked and show each die.
- **Search and sort:** a search box narrows the rows, and clicking a column's name sorts by it.
- **Checkboxes** can be ticked straight from the article page.
- **Show a table in any article** with `![[Table name]]`, or `![[Table name|Your caption]]`. Change the table once and it updates everywhere.
- **Paste from a spreadsheet** (Excel, Google Sheets, Numbers) or **import a CSV**, and **export CSV** any time.
- **Stays connected:** Article cells count as links (the table appears under *Mentioned in*), renaming an article updates them, and search finds words in table cells.
- The example world has one to try: **Road Encounters in Vael**, shown at the bottom of the Vael article. There's a guide in [docs/TABLES.md](docs/TABLES.md).

### Header images
- **Full width:** article header images and world covers now span the whole page beside the sidebar. The title and text keep their width.
- **Header edges:** choose how the picture meets the page:
  - **Fade:** the soft gradient, as before.
  - **Torn:** a painted, ragged edge.
  - **Mist:** a bank of soft cloud.
  - **Hard cut:** a straight edge.
- **Per world and per device:** set a default in **Settings → Appearance**. Each world can follow it or choose its own in **World settings**. Both show a live preview.
- **World overview:** the overview page uses the edge too, with the world's name below its cover.

### Look and feel
- **New buttons:** a faint brass ring, a slight lift and a soft sheen on hover. Main actions are a deeper oxblood red that sits better with the gold of the dark theme. (Motion is off if your device asks for reduced motion.)
- **Tidier prompt card:** the two main actions sit side by side, with *Another*, *Already covered* and *Not for me* in a quiet row beneath.
- **Scrollbars** match the theme.

### Sidebar
- **World settings** is one click away, next to the world's name.
- **Fold the sidebar** to just its icons (on wider screens). Hover an icon to see its name. It remembers your choice.

### Reading and writing
- **Article text size and weight:** sliders in **Settings → Appearance**, with a live sample. They change what you've written in articles, and leave the rest of the app as it is. This replaces the old *Text weight* switch.
- **Read a random article** from the world overview, for when you want to wander.
- **See your world card while you set the cover:** World settings shows the card exactly as it appears on the worlds page, and updates as you move the picture.

### Backgrounds
- **Spell circles:** a new background pattern of rune rings, as faint as the others.

### Notes
- Worlds set to the 1.55 "Mist" edge show as **Torn**, the edge they were using. The new **Mist** is the cloud edge.

## 1.55.0 · 4 November 2026
- **Header edge** choice per world: Fade, Mist (a painted edge) or Hard cut.
- **Spell circles** background.
