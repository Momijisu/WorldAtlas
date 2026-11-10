# Statblocks

A statblock holds a creature's or character's game statistics: armour, hit points, abilities, traits and actions. Put one in any article: a species, a character, a monster in a location.

The example world has one to try: the **Mistfox**.

## Add a statblock

1. Edit an article and put the cursor where the statblock should go.
2. Choose **Statblock** on the editor's toolbar.
3. Fill in what you need. Every field is optional. Ability modifiers are worked out as you type the scores.
4. Add sections such as *Traits*, *Actions*, *Bonus Actions* or *Reactions*, written in Markdown. **+ Section** adds another.
5. Choose **Add statblock**.

To change it, put the cursor anywhere in it and choose **Statblock** again. **Remove statblock** takes it out.

## How it's written

The statblock is part of the article's text, so it syncs, keeps version history and merges like the rest. In the Markdown view it looks like this:

````
```statblock
name: Boar
type: Medium Beast, Unaligned
ac: 11
initiative: +0 (10)
hp: 13 (2d8 + 4)
speed: 40 ft.
str: 13 | dex: 11 | con: 14 | int: 2 | wis: 9 | cha: 5
senses: Passive Perception 9
languages: None
cr: 1/4 (XP 50; PB +2)

## Traits
***Bloodied Fury.*** While [[Bloodied]], the boar has Advantage on attack rolls.

## Actions
***Gore.*** *Melee Attack Roll:* +3, reach 5 ft. *Hit:* 4 (1d6 + 1) Piercing damage.
```
````

You can write or change it by hand too.

- **Lines it knows:** `name`, `type`, `ac`, `initiative`, `hp`, `speed`, the six abilities (`str` to `cha`, on one line separated by `|` or one per line), `saves`, `skills`, `resistances`, `vulnerabilities`, `immunities`, `gear`, `senses`, `languages` and `cr`.
- **Other lines:** anything else, like `legendary resistance: 3/Day`, is shown with its own label.
- **Saving throws:** each save shows the ability's modifier unless `saves:` lists a different one, such as `saves: Dex +5, Con +4`. Those are highlighted.
- **Sections:** start each one with a `## Heading`. Their text is Markdown, so `[[links]]`, **bold** and *italic* work.

## On the page

- **Layout:** the core stats sit on the left and the sections on the right, one above the other on narrow screens.
- **Rolls:** any roll in the text, such as `2d8 + 4` or `1d6 + 1`, can be clicked to roll it. The total shows beside it.
- **Previews:** hovering a link to the article shows its AC, HP, speed, CR and abilities in the preview card.
- **Links:** `[[links]]` in a statblock count as links to those articles (they show under *Mentioned in*), and renaming an article updates them.
