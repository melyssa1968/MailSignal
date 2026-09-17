# MailSignal — personal sales email tracking

Source snapshot of the working MailSignal app, including Gmail extension **0.4.0**.

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

MailSignal now centers on individual messages composed and sent directly in Gmail. The dashboard lists recipient, subject, sent time, image loads, possible opens, first and latest activity, and an event timeline. Campaign data from the first version is retained and presented as individual sent rows; the old sender is no longer the primary UI.

## Gmail integration

`extension/` contains a desktop Chrome/Edge Manifest V3 extension using the bundled InboxSDK. `node scripts/build-extension.mjs` builds the downloadable `public/mailsignal-gmail.zip`. Users install it as an unpacked extension, generate a dashboard connection key, and supply their own registered InboxSDK App ID. No fake or shared App ID is included. Installation and a live Gmail acceptance test remain necessary; this is not a Chrome Web Store release.

The SDK request modifier appends the pixel to the outgoing send payload, not to draft DOM or autosaves. Native Gmail owns sending, formatting, attachments, and the sender account. This integration never clicks Send programmatically. The extension transmits only recipient, subject, sender, and tracking identifiers to MailSignal; email bodies are not uploaded to the app. `sent` confirmation is idempotent and retried from the extension for up to 24 hours. If preparation fails, the email sends normally without tracking and the extension reports this. Plain text messages are skipped. To/CC/BCC messages are supported when at least one recipient is eligible. A shared pixel measures message-level activity and cannot identify which recipient viewed it. Extension options show the latest send result, including skipped tracking or pending confirmation.

## Domain exclusions

Per-owner settings store an explicit editable list of excluded recipient domains. Matching is case-insensitive and includes subdomains, with a dot boundary: `example.com` excludes `team.example.com`, but not `notexample.com`. Messages are skipped only when every recipient is excluded or matches the sender. The same eligibility rule suppresses future collection and hides existing records if all recipients become excluded. Historical rows are retained. Exclusions are evaluated on the server for every preparation and pixel load. The exact From address is not an eligible recipient; copying that address does not prevent tracking for other eligible recipients.

These rules do not identify the domain of the person opening a message. Gmail image proxies cannot reliably establish opener identity. Sender views in Sent, forwarding, privacy preloads, or use from another device can still affect counts. Pixels are engagement signals, not read receipts. No raw IP addresses are stored. New activity records include approximate request city/region/country and network organization/ASN when supplied by the hosting runtime. These may describe an intermediary, not the viewer.

## Authentication and activation

The site audience is public so email image clients and the extension can reach the collector. Production `PIXEL_PUBLIC_READY=true` enables collection. Dashboard routes require ChatGPT sign-in; campaign/message/settings APIs enforce per-owner scoping. Extension keys are generated while signed in, stored only as SHA-256 hashes on the server, and kept in the user's extension-local browser storage. They grant only the limited Gmail preparation/confirmation API and exclusion-rule readback, not analytics access. Keys can be rotated or revoked. Public image URLs contain opaque UUIDs, not recipient addresses.

## Validation

- `node scripts/verify-tracking.cjs`: real in-memory SQLite API tests, including migrations, ownership, CSRF, key revocation, domain matching, retroactive suppression, idempotent message creation/confirmation, and original tracking behavior.
- `node scripts/verify-extension.cjs`: mocked SDK verification of outgoing payload insertion, draft suppression, metadata-only transmission, send confirmation, opt-out, and failure fallback. This is not a live Gmail test.
- `node node_modules/typescript/bin/tsc --noEmit`: application type checking.
- Use the Sites build and publish workflow with the existing project identity. Applied migrations are immutable; changes append migrations.

No real emails were sent during development. No browser/WebMCP runtime testing was performed in this environment. Local `.env` uses the same keys as `.env.example`; hosted values are managed separately. Do not add real connection keys or credentials to source or the extension download.

## Interpreting activity

The main list counts screened activity sessions, not verified reads. Immediate loads (within 10 seconds), known automation/prefetch, unknown client signatures, bursts across at least three same-owner emails within one second of an event, and possible sender-view overlaps are excluded. New events wait three seconds for burst checks; requests less than 30 seconds apart form one activity session. Filtering runs on reads, so historical bursts are corrected too. The raw timeline retains all requests and explains exclusions. The first/last activity columns use screened activity only. Individual requests can be ignored and restored by the owner.

Sender-view protection in extension 0.4.0 blocks direct MailSignal pixel image loads initiated by Gmail in that browser profile. An additional DOM observer reports tracked message IDs when Gmail renders images, including proxy URLs whose fragments retain the original pixel address; server events within five seconds are marked possible self-views. This cannot prevent server-side Gmail proxy fetching, track another device, or prove that a coincident prospect view was internal. No email body is uploaded. Do not use this same browser profile for an independent recipient acceptance test.

No activity does not mean unread. Later screened image activity still does not establish identity or a human read. These are conservative heuristics, not a proprietary bot-detection service. See `docs/tracking-redesign.md` for the incident, comparison, design, and validation.

## Request location and network

Open an email’s Activity timeline to see approximate request location, network organization/ASN, and a Google proxy signature when detected. Missing metadata displays Unavailable; older records display Not collected. These fields never identify an email domain or employer. No reverse-DNS lookup, raw IP storage, precise coordinates, or external geolocation service is used. Collection uses only runtime Request.cf metadata, not caller-supplied forwarding/location headers. Extension 0.4.0 adds sender-view defenses; replace files in the existing installed folder and reload to preserve settings.
