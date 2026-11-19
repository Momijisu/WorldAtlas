# Contributing to WorldAtlas

Thank you for helping! Bug reports, ideas and code are all welcome. By taking part you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Reporting a bug

[Open an issue](https://github.com/Momijisu/WorldAtlas/issues/new/choose) with the **Bug report** form. The most useful reports say:

- what you did, what you expected, and what happened instead;
- the version, from **Settings → About this app**;
- your device and browser, and whether you use the installed app or a browser tab;
- whether you sync, and how (OneDrive or a custom folder);
- a screenshot, if it shows the problem.

Please don't attach your worlds or backups to a public issue: they're yours and private. If a problem only happens with a particular world, say so and the maintainer will find a private way to look at it.

Found a security problem? Please don't open an issue: see the [security policy](SECURITY.md).

## Suggesting a feature

Use the **Feature request** form. Describe what you're trying to do in your world or game, not only the button you'd like: there's often more than one way to solve it. Check the [roadmap](README.md#roadmap) and existing issues first.

## Changing the code

WorldAtlas is plain HTML, CSS and JavaScript (ES modules), with no framework and no build step. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) explains the project layout.

```sh
git clone https://github.com/Momijisu/WorldAtlas.git
cd WorldAtlas
python3 -m http.server 8000   # then open http://localhost:8000
```

Edit a file and reload the page.

### Branches

- Work happens on **`staging`**; base your branch on it and open your pull request against it.
- **`main`** is what's live on GitHub Pages. It only moves when a release is made.

### Before you open a pull request

1. **Run the tests:** `tests/run.sh`, or `tests/run.sh <name>` for the ones whose names contain `<name>`. They need Node with Playwright and Chromium. Add or update a test for what you changed: the existing tests in `tests/` show how.
2. **Add a line to `CHANGELOG.md`** under the newest heading (start a new `## x.y.z` heading if the newest one has a date, so is already released). It's shown in the app as *What's new*, so write it for the people using the app: say what they can now do, in plain words.
3. **New files?** Add them to `SHELL` in `sw.js`, or they won't work offline.
4. **Check both themes** (Settings → Appearance) and a phone-sized window.

Leave the version number alone; it's set when a release is made.

### What fits the project

- **Private by design.** Worlds stay on the user's devices and their own cloud storage. No servers, accounts, tracking, analytics or third-party requests that could see someone's work.
- **No build step.** Plain files the browser can load as they are. Avoid new dependencies; if one is truly needed, it goes in `vendor/` with its license.
- **Works offline,** in every modern browser, on phones as well as computers.
- **Plain words** in the interface: short labels, and help text only where it tells people something they couldn't guess.
- **Keep changes focused:** one feature or fix per pull request is easier to review.

## Questions

Ask in an issue: there are no silly questions.
