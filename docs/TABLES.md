# Tables

Tables hold anything that fits in rows and columns: random encounters, price lists, rosters, rumours, a party's quest checklist. Readers can search a table, sort it by any column, roll a random row and roll the dice in it.

A table is an article like any other. It syncs, keeps version history, can be linked to and found by search, and goes to Recently deleted if you delete it.

The example world, Aerthal, has one to try: **Road Encounters in Vael**, also shown at the bottom of the Vael article.

## 1. Make a table

1. Choose **New article** and pick the **Table** template (under *Other*). If an article already exists, you can switch its template to Table in the editor.
2. Give it a title. The **Table** section appears below the summary, with two columns and three empty rows to start.
3. Choose **Save**.

The article's **Content** still works as usual. Whatever you write there shows above the table, so it's a good place to explain how to use it.

## 2. Fill it in

- **Type in the cells.** Each row is a line of the table and each column has a name and a type (see below).
- **Add rows and columns** with **+ Row** and **+ Column**.
- **Reorder rows** by dragging the handle at the left of a row. **Reorder columns** with the arrows next to the column's name.
- **Delete** a row with the ✕ at its end, or a column with its bin icon. Both ask first if anything would be lost.
- **Paste from a spreadsheet.** Copy cells in Excel, Google Sheets or Numbers, choose **Paste from a spreadsheet** and paste them in. CSV text works too. The first row can be the column names. You can replace the table or add the rows to it, matching columns by name. Column types are guessed from what you paste: numbers, dice rolls, ticks or text.
- **Import CSV** reads a `.csv` file the same way. **Export CSV** saves the table as a file you can open in any spreadsheet.

Rows left completely empty are dropped when you save.

## 3. Show it in another article

Write the table's title in an excerpt on a line of its own:

```
![[Road Encounters in Vael]]
```

The whole table appears there, ready to search, sort and roll. Give it a caption of your own with `![[Road Encounters in Vael|What comes in the night]]`. The caption links back to the table's own page.

The table stays in one place, so any change to it shows everywhere it's used.

## Column types

Choose a column's type from the menu under its name. You can change it later. Ticks and text convert both ways.

| Type | For | On the page |
|---|---|---|
| **Text** | Short text. `[[links]]`, **bold** and *italic* work. | As written |
| **Long text** | Paragraphs, lists and callouts, written like an article. | Formatted like an article |
| **Number** | Amounts, levels, prices. | Right-aligned, and sorts by value |
| **Checkbox** | Quest steps, who has met whom, things found. | A box readers can tick straight from the article. Ticking saves it. |
| **Article** | The title of an article in this world. Suggestions appear as you type. | A link to the article. Renaming the article updates the cell. |
| **Web link** | An address on the web. | A link that opens in a new tab |
| **Dice** | A roll such as `2d6+1`, `d20`, `1d8 + 1d4 - 2` or `d%`. | A button that rolls it and shows the total and each die |
| **Chance** | How likely the row is when rolling the table. | Hidden. A row with 3 comes up three times as often as one with 1. 0 never comes up. Empty counts as 1. |

## Reading tools

Under the table in the editor, choose which tools readers get:

- **Search box:** shows only the rows containing every word you type. Rolling then picks from those rows.
- **Roll button:** picks a random row, highlights it, rolls any dice in that row and says what came up. It uses the **Chance** column if the table has one.
- **Row numbers:** numbers each row, in the order you set in the editor.

Clicking a column's name sorts by it. Click again to reverse the order, and a third time to go back to the table's own order.

## Changes, history and clashes

Every save keeps a version in the article's **History**, so you can see or restore an earlier table.

If the same table is changed on two devices before they sync, both versions are kept and the merge manager shows them side by side, so you choose which to keep.

Search and backlinks read table cells too. An **Article** cell counts as a link, so the table appears under *Mentioned in* on that article.

## Deleting a table

Delete it like any article: **Edit** → **Delete**. It goes to **Recently deleted**, where you can restore it.

While it's deleted, articles that show it with `![[…]]` say there's no such article. They show it again once it's restored.
