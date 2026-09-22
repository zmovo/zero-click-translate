# Store QA checklist

Run this on an unpacked `1.0.0` load after `chrome://extensions` → Developer mode.

## Happy path

- [ ] ChatGPT: select a Chinese sentence → English card beside the selection, no extra click
- [ ] ChatGPT: select an English sentence → Chinese card
- [ ] Claude: same as above; no `Node.contains` error in the page console
- [ ] Google Search results: select a snippet → card
- [ ] GitHub README: select a paragraph → card
- [ ] Card shows `已捕捉` / `Captured` and the translation body
- [ ] Service worker log shows Cloud first: `/register` once, then `/translate` with `Authorization: Bearer`

## Toolbar

- [ ] Popup: Translate toggle on, language pair 中文 ↔ English, quota `N / 10,000`
- [ ] Change pair (e.g. English ↔ 日本語), select text, badge follows the pair
- [ ] Turn Translate **off**: reload or switch tab, select text → no card, no content script
- [ ] Turn Translate **on** again → card returns
- [ ] Input / textarea: select or type → no miss popup

## Quota and Upgrade

- [ ] Quota counts characters of the source selection
- [ ] When remaining is 0, card says `Free limit reached` with reset line and **Upgrade**
- [ ] Upgrade opens `pricing.html` (Pro extra quota; payments not available)
- [ ] Reinstalling resets local quota (known; do not treat as a blocker for 1.0.0)

## Auth

- [ ] First translate: `POST /register` with `{ installationId }`, then `POST /translate`
- [ ] Later translates: no new register unless 401
- [ ] Forced 401: token cleared, one re-register, one retry, then fallbacks if still failing

## Package

- [ ] `manifest.json` version `1.0.0`
- [ ] Icons 16 / 32 / 48 / 128 present
- [ ] Zip has no `.git`, `store/`, or secrets
- [ ] Search the zip for `AIza` and `JWT_SECRET` — must be empty
