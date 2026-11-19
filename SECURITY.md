# Security policy

WorldAtlas has no server or database of its own: worlds are kept in the browser on each device, and optionally in the user's own OneDrive or synced folder. The security that matters most is keeping someone's worlds private to them, and keeping files they open (worlds, backups, imports, pictures) from doing anything harmful.

## Supported versions

Only the latest version is supported: the one at [momijisu.github.io/WorldAtlas](https://momijisu.github.io/WorldAtlas/), which installed apps update to. If you host your own copy, update it from `main` to get fixes.

## Reporting a vulnerability

**Please report it privately, not in a public issue.**

Use GitHub's private reporting: the repository's **Security** tab → **Report a vulnerability**. Only the maintainer can see the report.

Please include:

- what the problem is and what an attacker could do with it;
- the steps (or a file) that reproduce it;
- the version (**Settings → About this app**) and the browser you tested.

Please don't include anyone's real worlds or personal data.

## What happens next

This is a project maintained in spare time, so there's no formal timetable. You can expect:

- an acknowledgement within a few days;
- a fix released as quickly as its seriousness calls for;
- credit in the release notes once it's fixed, if you'd like it.

## Particularly welcome

- Content in a world, backup, `.world` file or import that runs script or otherwise escapes its sandbox when opened or viewed (for example, getting past the Markdown sanitising).
- Ways for another site, another user or a shared OneDrive folder to read or change someone's worlds.
- Problems with how OneDrive sign-in tokens are handled or stored.
- Anything that makes the app contact a third party with a user's data.
