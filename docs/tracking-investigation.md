# Tracking investigation — September 17, 2026

Production request logs showed GoogleImageProxy image requests approximately 0.4 and 1.1 seconds after nearby send confirmations. Redacted pixel tokens prevent proving the exact message correlation. These logs do not identify a human viewer or establish the cause of the fetch.

The extension appends the pixel only to the outgoing SDK request payload, not the draft DOM. We found no direct draft-image fetch in this path. Gmail Sent views, recipient views, and proxy activity remain indistinguishable at the collector. Removing images after Gmail renders them can be too late; no reliable self-view suppression is claimed or implemented.

Changes: support mixed eligible/excluded To/CC/BCC recipients; retain all recipients with message-level attribution; label requests within 10 seconds of server confirmation as possibly automatic; retain recorded events in an owner-scoped timeline; show latest send outcome in extension options. The threshold is a heuristic, not evidence of automation. Delayed send confirmation may skew timing. Requests before confirmation continue to be ignored by the collector, so the timeline is not a complete network audit.

No IP/location collection was added. Proxy addresses do not establish recipient identity or location. A shared pixel cannot distinguish an internal CC from a prospect, and caching may hide subsequent views.

Validation uses real SQLite API tests including migrations, mixed-recipient rules, timeline ownership and threshold boundaries; mocked InboxSDK tests; TypeScript checking and production build. No live Gmail send or browser test was performed for this release.
