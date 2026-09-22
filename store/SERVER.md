# Cloud Run checklist (do this in GCP, not in the extension)

Google’s Translation API key must **not** ship in the Chrome package. Confirm these on the existing service `zero-click-translate-api` in `europe-west1`.

## Secrets

- [ ] `JWT_SECRET` is an environment variable on Cloud Run only. It is not in this repo, not in the zip, and not in Cloud Run source.
- [ ] Google Cloud Translation is called with a server-side key or the Cloud Run service account. That key is API-restricted to **Cloud Translation API**.
- [ ] Application restriction: prefer **IP / service identity** of Cloud Run, not `chrome-extension://` (the browser never sees this key).

## API contract the extension already uses

- `POST /register` body `{ "installationId": "<uuid>" }` → `{ ok: true, data: { token } }`
- `POST /translate` header `Authorization: Bearer <token>` body `{ "text", "target" }` (`target` is `zh-CN` or `en`)
- Expired token → `401` so the extension can register once more

## Review answers

If Chrome asks who receives user content: Cloud Run in `europe-west1`, then Google Cloud Translation. Fallbacks are Google webpage translate and MyMemory, only if Cloud Run fails.
