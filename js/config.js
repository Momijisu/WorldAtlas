// OneDrive / Microsoft sign-in configuration.
//
// Paste the "Application (client) ID" of your Azure app registration here
// (see README.md → "Set up OneDrive sync"). It can also be entered at runtime
// on the Settings page, which overrides this value for that device.
export const CLIENT_ID = '';

// "common" allows both personal Microsoft accounts and work/school accounts.
// Use "consumers" if you registered the app for personal accounts only.
export const AUTHORITY = 'common';

// Name of the data file inside OneDrive → Apps → WorldAtlas.
export const REMOTE_FILE = 'atlas.json';
