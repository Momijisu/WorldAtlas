# What's new

## 1.64.0

### .world files
- **Export a whole world as one file:** its articles, maps, version history and every picture, in a single **.world** file. Settings → World files, or **Export .world** in World settings.
- **Open a .world file** to add the world on another device, or to share it. Opening a world you already have merges it in: newer work is kept, and an article changed in both places goes to the merge manager.
- With the installed app in Chrome or Edge, double-click a .world file to open it in WorldAtlas.
- The text export, for AI assistants, is still in Settings → Import from text.

### Sync through a folder
- **Point WorldAtlas to a folder on your PC** and use any cloud storage you like to keep it in step between your computers: **Settings → Sync → A folder on your PC → Choose folder**. WorldAtlas only reads and writes the folder, and never sees your cloud account.
- Merges like OneDrive sync: edits to different articles combine, and an article changed on two computers goes to the merge manager, including when the folder app has kept a "conflicted copy".
- **One Sync panel:** Settings → Sync lets you choose how to sync (OneDrive or a folder on your PC) and shows the setup for that one. A device uses one at a time; choosing the other offers to switch.
- Chrome and Edge on a computer. See [docs/SYNC.md](docs/SYNC.md#syncing-through-a-folder).

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
