# Privacy Policy — Zero Click Translate

Last updated: 22 September 2026

Zero Click Translate is a Chrome extension that shows a translation next to text you select. It does not use accounts, logins, browsing history, or advertising.

## What we process

When translation is on and you select text on a webpage, the extension sends **the selected text** and the **target language** to a translation service so it can return a translation.

The extension also stores a small amount of data **on your device**:

- on/off state and the language pair you picked
- how many characters you have used this month (local quota)
- an anonymous `installationId` and a short-lived `authToken` used to call our translation API

No name, email, Google account, or payment information is collected.

## Where selected text goes

Translation is attempted in this order:

1. Our Cloud Run API at `https://zero-click-translate-api-475510566240.europe-west1.run.app` (`/register` once, then `/translate`). That service forwards the text to Google Cloud Translation.
2. If that fails, public Google Translate webpage endpoints.
3. If those fail, [MyMemory](https://mymemory.translated.net/).

Turning the extension **off** stops page injection. The extension then does not read selections or send text.

## Why the extension asks for site access

`http://*/*` and `https://*/*` are required so the overlay can appear on the page you are reading. The extension does not scrape the rest of the page for translation. It only uses the current selection.

`storage` keeps the settings and anonymous tokens listed above on this device. Reinstalling the extension clears that local data.

## What we do not do

- We do not sell data.
- We do not use selected text for ads or profiling.
- We do not create user accounts.
- We do not run remote code from the store package.

## Children

The extension is not directed at children under 13 and does not knowingly collect personal information from them.

## Changes

If this policy changes, we will update the date at the top of this page.

## Contact

Open an issue at [github.com/zmovo/zero-click-translate](https://github.com/zmovo/zero-click-translate/issues).
