# What's new

## 1.57.0

### Tables, now inside articles
- **Add a table anywhere in an article** with the new **Table** button on the editor's toolbar. A grid opens to fill in; the table is written into the article's text. Put the cursor in a table and press **Table** again to change it.
- **Roll like a printed table:** name the first column after a die (`d8`, `d20`…) and fill it with numbers or ranges (`1–2`, `3`), and **Roll** rolls that die and lands on the matching row. A **Chance** column still weights rows instead.
- **Cells work out what they hold:** a roll like `2d6` gets a dice button, `[ ]` and `[x]` become checkboxes you can tick on the page, and a column of numbers lines up and sorts by value.
- **Show a table elsewhere** by quoting its section: `![[Vael#On the road]]`.
- **The Table template is gone.** Tables made with it in 1.56 have moved into their article's text, with links, ticks and chances kept.
- Vael's road encounters in the example world are now a d8 table in the Vael article. See [docs/TABLES.md](docs/TABLES.md).

### Header images
- The **Torn** edge repeats seamlessly on wide screens.

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
