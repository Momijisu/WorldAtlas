# Tables

Tables go straight into an article's text, wherever you need one: random encounters in a region, prices in a market, a guild's ranks, a quest checklist. Readers can sort them, search the longer ones, roll a random row and roll the dice in them.

A table is part of the article's text, so it syncs, keeps version history, merges line by line and can be quoted elsewhere like any other text.

The example world, Aerthal, has one to try: **On the road**, at the bottom of the Vael article.

## 1. Add a table

1. Edit an article and put the cursor where the table should go.
2. Choose **Table** on the editor's toolbar. A grid opens with two columns and three rows.
3. Name the columns, fill in the cells and choose **Add table**.

The table is written into the text as a Markdown table, lined up so it reads well as plain text too:

```
| d8  | Encounter                          | How many | Most likely near  |
| --- | ---------------------------------- | -------- | ----------------- |
| 1–2 | Lantern Guild couriers, in a hurry | 1d4      | [[Lantern Guild]] |
| 3–4 | Flood-wardens checking the levees  | 2d4      | [[River Ost]]     |
```

You can write or change it by hand too.

## 2. Change a table

Put the cursor anywhere in the table and choose **Table** again. The grid opens with that table in it.

- **Type in the cells.** **Enter** moves down a row, adding one at the end. **Shift+Enter** starts a new line in the cell.
- **Add rows and columns** with **+ Row** and **+ Column**.
- **Reorder rows** by dragging the handle at the left of a row. **Reorder columns** with the arrows under the column's name.
- **Delete** a row with its ✕, or a column with its bin icon. Both ask first if anything would be lost.
- **Remove table** takes the whole table out of the text.
- **Paste from a spreadsheet:** copy cells in Excel, Google Sheets or Numbers and paste them in. CSV text works too. You can replace the table or add the rows to it, matching columns by name.
- **Import CSV** reads a `.csv` file the same way. **Export CSV** saves the table as a file for any spreadsheet.

Rows left completely empty are dropped.

## What cells can hold

- **Text,** with `[[links]]`, `[[Article|labels]]`, **bold** and *italic*, as anywhere else.
- **A roll,** such as `2d6+1`, `d20`, `1d8 + 1d4 - 2` or `d%`, on its own in a cell. It becomes a button that rolls it and shows the total and each die.
- **`[ ]` or `[x]`:** a checkbox. Tick it on the article's page and the text changes to match, so it saves and syncs. Good for quest steps and things found.
- **Numbers:** a column of only numbers lines up on the right and sorts by value.

## Reading tools

- **Sort:** click a column's name. Click again to reverse, and a third time to go back to the table's own order.
- **Search:** tables with 6 or more rows get a search box that shows only the rows containing every word you type.
- **Roll:** tables with 3 or more rows get a **Roll** button that picks a row, highlights it and rolls any dice in it. It picks in one of three ways:
  - **By die:** name the first column after a die (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100` or `d%`) and fill it with numbers or ranges (`1–2`, `3`, `19+`). Roll rolls that die and lands on the matching row, just like a printed table.
  - **By chance:** a column called **Chance** makes some rows more likely than others. A row with 3 comes up three times as often as one with 1, 0 never comes up, and empty counts as 1. The column stays hidden from readers.
  - **Evenly:** otherwise every row is as likely. If a search is active, Roll picks only from the rows shown.

## Showing a table in another article

Put the table under a heading and quote that section:

```
![[Vael#On the road]]
```

It appears with its tools, ready to sort and roll. A quoted table can't be ticked. Tick it on its own article's page. Change it there and it updates everywhere it's quoted.

## Tables from 1.56

1.56 had a separate Table template. Those tables have moved into their article's own text as ordinary tables, and the articles are now ordinary articles. Nothing is lost: links, ticks and chances are kept.
