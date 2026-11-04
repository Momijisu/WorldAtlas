# Syncing with OneDrive

Sync is optional. It keeps the same worlds on all your devices through a private folder in your own OneDrive. WorldAtlas has no server of its own.

## Using the online version

On https://momijisu.github.io/WorldAtlas/ there's nothing to set up. Go to **Settings → OneDrive sync → Connect OneDrive** and sign in with your Microsoft account.

On iPhone and iPad, connect from inside the installed app. iOS keeps an installed app's storage separate from the browser's.

## Setting up sync for your own copy

Microsoft only lets a web app sign in from addresses it has registered, so a copy you run or host yourself needs its own (free) app registration. This is a one-time setup.

1. Sign in at https://entra.microsoft.com with the Microsoft account whose OneDrive you'll use. If it won't accept a personal account, create a free Azure account first (it asks for a card to verify you, but doesn't charge).
2. Go to **App registrations → New registration**:
   - **Supported account types:** *Accounts in any organizational directory and personal Microsoft accounts*
   - **Redirect URI:** choose **Single-page application** and enter your copy's address, ending in `/`. For example `https://<your-name>.github.io/WorldAtlas/`, or `http://localhost:8000/` for a copy on your own computer. Settings shows the exact address, with a Copy button.
3. Copy the **Application (client) ID** from the registration's overview page. Then either:
   - paste it into `js/config.js` (`CLIENT_ID`) so every device uses it, or
   - leave `js/config.js` empty and paste the ID into **Settings → OneDrive sync** on each device.
4. In the app, choose **Connect OneDrive**.

You can add more redirect addresses to the same registration later, for example your hosted copy and `http://localhost:8000/`.

### Permissions

WorldAtlas asks for:
- `Files.ReadWrite.AppFolder`, which reaches only `OneDrive/Apps/WorldAtlas`;
- `User.Read`, to show your name.

It can't see anything else in your OneDrive.

## How syncing works

Each device keeps a full copy of your worlds in the browser (IndexedDB), so everything works offline. Sync runs:
- shortly after each edit;
- when the app is opened or comes back online;
- every two minutes.

- **Merging:** edits to different articles merge on their own. If the same article changes on two devices before they sync, both versions are kept and the article is flagged, so you can choose what to keep.
- **Renaming:** renaming a world renames its folder.
- **Deleting:** deleting a world removes it on your other devices too.
- **Sharing:** to share a world with someone, share its folder from OneDrive.

### What's in the OneDrive folder

```
Apps/WorldAtlas/
  Worlds/<world name>/world.json     the world, its articles and maps
  Worlds/<world name>/history.json   its article versions
  Worlds/<world name>/images/        its pictures and fonts
  deleted.json                       worlds you've deleted, so other devices remove them too
  Legacy/                            files from an older layout, moved aside
```

### Staying signed in

Microsoft limits a browser sign-in to 24 hours. WorldAtlas renews it in the background before then, so nothing interrupts you.

Browsers that block third-party sign-in cookies, such as Safari, can't renew this way. There the sync badge shows **Reconnect**, and one tap signs you back in.
