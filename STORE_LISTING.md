# Chrome Web Store listing copy

Paste these fields into the developer dashboard. Language: English (United States). Add a Chinese (China) listing with the Chinese block below.

**Category:** prefer **Tools**. If that is missing, try **Workflow & Planning** or **Education**. Do not block on “Productivity” — some developer dashboards hide or grey it out; pick the closest available Tools-like option and continue.

Privacy policy URL (preferred, after GitHub Pages is enabled on `main` / root):

https://zmovo.github.io/zero-click-translate/privacy.html

Markdown fallback (also public):

https://github.com/zmovo/zero-click-translate/blob/main/PRIVACY.md

Homepage / support: https://github.com/zmovo/zero-click-translate

Submit steps: see `store/SUBMIT.md`.

## English

**Name** (75)

Zero Click Translate – Instant Translator

**Short description** (132)

Select text to translate it instantly. Defaults to Chinese ↔ English.

**Detailed description**

Zero Click Translate shows a translation next to the text you select. No extra click in the happy path.

• Defaults to Chinese ↔ English. Change the pair from the toolbar popup.
• Turn Translate off when you only want to copy. While it is off, the extension does not inject scripts into pages.
• Free monthly character quota. When it runs out, an Upgrade page explains the reset. Payments are not available yet.
• No login, settings page, history, or account.

Select text on ChatGPT, Google, GitHub, or any normal webpage. The card appears beside the selection in about a second.

The extension sends only the selected text to a translation API (Cloud Run → Google Cloud Translation), with public Google and MyMemory fallbacks if that API is down.

**Single purpose**

Instantly translate selected text on web pages.

## 中文（商店本地化）

**名称**

划词即翻译 – Instant Translator

**简介**

选中文字，译文出现在旁边。默认中英互译，也可更换语言对。

**详细描述**

划词即翻译：选中文字，译文出现在旁边，不用再点一次。

• 默认中英互译，可在工具栏更换语言对
• 关掉「翻译」后不再向页面注入脚本，方便只复制
• 免费按月字符额度；用尽后可打开 Upgrade 页查看重置时间。付款尚未开放
• 无登录、无设置页、无历史、无账号

可在 ChatGPT、Google、GitHub 等页面使用。扩展只把当前选区发到翻译接口。

## Permission justifications

Use these answers in the dashboard if Chrome asks.

**scripting**
Inject the selection overlay only while Translate is on. The extension unregisters that script when Translate is off.

**storage**
Save on/off, language pair, local monthly quota, and an anonymous installation id / auth token. Nothing is synced to a user account.

**Host access `http://*/*` and `https://*/*`**
The overlay must run on the page the user is reading. Only the current selection is translated. Broad access is required because users select text on many sites.

**Host access to `https://zero-click-translate-api-475510566240.europe-west1.run.app/*`**
Send the selected text to our translate API (`/register`, `/translate`).

## Data safety form

- User-generated content: yes — selected text, used to provide the translation
- Sold: no
- Used for ads / credit / lending: no
- Account required: no
- Remote code: no
- Encryption in transit: yes (HTTPS)

## Images to upload

From `store/listing/`:

- Store icon: `store-icon-128.png` (opaque 128×128; prefer this over toolbar `icons/icon128.png` if upload complains about transparency)
- Small tile: **`tile-440x280.jpg`** (exact 440×280 JPEG — use this if PNG is rejected)
- Screenshots (1280×800): prefer `shot-overlay.jpg`, `shot-popup.jpg`, `shot-quota.jpg`
