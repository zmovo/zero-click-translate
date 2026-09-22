# Chrome Web Store submit checklist

## Before upload

1. Run `powershell -File scripts\pack.ps1` → `dist/zero-click-translate-1.0.0.zip`
2. Confirm zip has no `.git`, `store/`, `scripts/`, `PRIVACY.md`, or secrets
3. Load the zip’s unpacked folder once and tick `store/QA.md`
4. Confirm Cloud Run checklist in `store/SERVER.md`

## Developer account

1. Open https://chrome.google.com/webstore/devconsole
2. Pay the one-time **$5** registration (Google account that will own the listing)
3. Create a new item → upload `dist/zero-click-translate-1.0.0.zip`

## Listing fields (paste from `STORE_LISTING.md`)

- Category: **Productivity**
- Language: English (United States) + Chinese (China) localization
- Privacy policy URL (after GitHub Pages is on):  
  `https://zmovo.github.io/zero-click-translate/privacy.html`  
  Interim: `https://github.com/zmovo/zero-click-translate/blob/main/PRIVACY.md`
- Homepage / support: `https://github.com/zmovo/zero-click-translate`
- Store icon: `icons/icon128.png`
- Small tile: `store/listing/tile-440x280.png`
- Screenshots: `store/listing/shot-overlay.png`, `shot-popup.png`, `shot-quota.png`

## Single purpose (required)

Instantly translate selected text on web pages.

## Review Q&A (copy if asked)

**Why broad host permissions?**  
The overlay must appear on the page the user is reading. Only the current selection is sent for translation. Access is unused while Translate is off (content script unregistered).

**What user data is collected?**  
Selected text (to translate), plus local on/off, language pair, monthly quota, anonymous `installationId`, and a short-lived JWT. No account, email, or browsing history.

**Who receives the text?**  
Primary: our Cloud Run API in `europe-west1`, which calls Google Cloud Translation. Fallbacks if that fails: public Google Translate webpage endpoints, then MyMemory.

**Remote code?**  
No. The store package is self-contained. Pricing is a static page; payments are not available yet.

**Visibility of commercialization**  
Free monthly character quota only. Upgrade explains reset / future Pro quota. No login, no Stripe in 1.0.0.
