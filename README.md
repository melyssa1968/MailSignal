# MailSignal — personal sales email tracking

Source snapshot of the working MailSignal app, including Gmail extension **0.2.2**.

Live dashboard: https://mail-signal.melyssa-plunkett.chatgpt.site

## Repository and deployment

This repository stores the application source. Publishing here does not move the running app or automatically deploy future GitHub changes. The current app uses ChatGPT Sites, Cloudflare Workers, D1, and platform-provided sign-in. GitHub Pages alone cannot run its backend. The extension currently points to the live dashboard above. Self-hosting requires adapting authentication, provisioning a database, and updating the extension origin and host permissions. The `.openai/hosting.json` file identifies the existing Site; it is not a credential.

## Local development

Use Node.js 22.13+ and the pnpm version declared in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Development uses local runtime state; production data and connection keys are not included.

## Installing and updating the extension

Download `public/mailsignal-gmail.zip`, unzip into a permanent folder, and use Chrome's Developer mode → Load unpacked. Configure your own connection key and registered InboxSDK App ID in Extension options. Keep only one MailSignal extension enabled. To update, replace files inside the same installed folder, reload the extension, and refresh Gmail. Installing from a different folder can create a new extension identity with separate settings.

The owner confirmed tracking worked in Gmail on September 15, 2026 after disabling an older duplicate extension. The automated extension tests use a mocked SDK and do not guarantee compatibility with every Gmail layout.

MailSignal now centers on individual messages composed and sent directly in Gmail. The dashboard lists recipient, subject, sent time, observed opens, first detected open, and latest detected open. Campaign data from the first version is retained and presented as individual sent rows; the old sender is no longer the primary UI.

## Gmail integration

`extension/` contains a desktop Chrome/Edge Manifest V3 extension using the bundled InboxSDK. `node scripts/build-extension.mjs` builds the downloadable `public/mailsignal-gmail.zip`. Users install it as an unpacked extension, generate a dashboard connection key, and supply their own registered InboxSDK App ID. No fake or shared App ID is included. Installation and a live Gmail acceptance test remain necessary; this is not a Chrome Web Store release.

The SDK request modifier appends the pixel to the outgoing send payload, not to draft DOM or autosaves. Native Gmail owns sending, formatting, attachments, and the sender account. This integration never clicks Send programmatically. The extension transmits only recipient, subject, sender, and tracking identifiers to MailSignal; email bodies are not uploaded to the app. `sent` confirmation is idempotent and retried from the extension for up to 24 hours. If preparation fails, the email sends normally without tracking and the extension reports this. Plain text and multi-recipient messages are skipped.

## Domain exclusions

Per-owner settings store an explicit editable list of excluded recipient domains. Matching is case-insensitive and includes subdomains, with a dot boundary: `example.com` excludes `team.example.com`, but not `notexample.com`. Exclusions prevent new tracking, suppress future event collection for existing links, and hide existing records in the main list. Historical rows are retained. Exclusions are evaluated on the server for every preparation and pixel load. Sending to the exact From address is also skipped.

These rules do not identify the domain of the person opening a message. Gmail image proxies cannot reliably establish opener identity. Sender views in Sent, forwarding, privacy preloads, or use from another device can still affect counts. Pixels are engagement signals, not read receipts. No IP addresses or inferred locations are stored.

## Authentication and activation

The site audience is public so email image clients and the extension can reach the collector. Production `PIXEL_PUBLIC_READY=true` enables collection. Dashboard routes require ChatGPT sign-in; campaign/message/settings APIs enforce per-owner scoping. Extension keys are generated while signed in, stored only as SHA-256 hashes on the server, and kept in the user's extension-local browser storage. They grant only the limited Gmail preparation/confirmation API and exclusion-rule readback, not analytics access. Keys can be rotated or revoked. Public image URLs contain opaque UUIDs, not recipient addresses.

## Validation

- `node scripts/verify-tracking.cjs`: real in-memory SQLite API tests, including migrations, ownership, CSRF, key revocation, domain matching, retroactive suppression, idempotent message creation/confirmation, and original tracking behavior.
- `node scripts/verify-extension.cjs`: mocked SDK verification of outgoing payload insertion, draft suppression, metadata-only transmission, send confirmation, opt-out, and failure fallback. This is not a live Gmail test.
- `node node_modules/typescript/bin/tsc --noEmit`: application type checking.
- Use the Sites build and publish workflow with the existing project identity. Applied migrations are immutable; changes append migrations.

No real emails were sent during development. No browser/WebMCP runtime testing was performed in this environment. Local `.env` uses the same keys as `.env.example`; hosted values are managed separately. Do not add real connection keys or credentials to source or the extension download.
