# Zero Click Translate – Instant Translator

Select text to see a translation beside it. Defaults to Chinese ↔ English.

Click the toolbar icon to turn translation on or off, or to change the language pair. While translation is off, the extension does not inject scripts into pages. There is no login, settings page, history, or account system.

Translation order:

1. Official Google Cloud Translation API (requires a local `secrets.js`)
2. Google Translate webpage fallback
3. Google Dictionary fallback
4. MyMemory

## API key

1. Copy `secrets.example.js` to `secrets.js`
2. Put your Cloud Translation API key in `GOOGLE_TRANSLATE_API_KEY`
3. Do not commit `secrets.js`

In Google Cloud, enable **Cloud Translation API** and restrict the key to that API.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** and select this folder
4. Click the extension icon to turn translation off when you only want to copy
5. Select text on ChatGPT, Google, or GitHub

The translation should appear beside the selection in about 0.5–1 second, with no extra click.
