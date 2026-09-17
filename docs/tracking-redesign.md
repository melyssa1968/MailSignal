# MailSignal tracking repair — September 17, 2026

## What the investigation established

Read-only production database inspection found five different tracked messages with event timestamps 1789675391013, 1789675391016, 1789675391034, 1789675391035, and 1789675391132: a 119ms span. These are distinct persisted events, not a shared dashboard timestamp. All were classified `unverified`, with no available location/network metadata. The previous implementation promoted every non-bot request more than ten seconds after sending to a possible open, without examining other messages. That was an application defect in classification.

The origin of the fetches remains unknown. The bounded production log window available during investigation contained newer requests, not headers from this burst. The data cannot distinguish a security scanner, mail client, other tool, or manual batch fetch. No specific vendor or person is attributed. Request headers are now recorded selectively (bounded client signature, purpose, fetch mode) to support future diagnosis; no raw IP is stored.

## Established products and design decision

[HubSpot tracking documentation](https://knowledge.hubspot.com/connected-email/understand-hubspot-sales-email-open-and-click-tracking) describes bot filtering, separate tracking/logging, inference from replies or clicks, and ambiguous multi-recipient attribution. [HubSpot self-open documentation](https://knowledge.hubspot.com/connected-email/block-self-open-notifications-with-the-hubspot-sales-outlook-add-in-or-chrome-extension) documents extension-based self-open protection and its browser/settings limitations.

[Yesware's published tracking explanation](https://www.yesware.com/blog/how-does-yesware-tracking-work/) describes the same pixel foundation, optional link tracking, and hosted tracked attachments. This older architecture article is useful for the pattern, not proof of current detection accuracy. Its [current product page](https://www.yesware.com/platform/gmail) keeps the workflow in Gmail.

The immediate repair keeps Gmail sending and adds actual filtering and sender-view defenses, rather than presenting a timeout alone as a detector. Link/document tracking and automatic reply ingestion are not implemented in this release. They require additional integration and still have distinct attribution/bot limitations; changing the core product to those features would not by itself fix this incident.

## Implemented behavior

- One shared classification query powers the dashboard and event timeline.
- Same-owner, same-category requests across three or more messages within one second of an event are marked simultaneous activity. This is evidence of suspicious shared loading, not proof of automation. Historical rows are re-evaluated without modifying original timestamps.
- Known bots/prefetch, immediate loads, unknown future request clients, pre-confirmation loads, sender-view overlaps, and manually ignored events do not count as screened activity.
- New events wait three seconds for burst detection. Remaining loads less than 30 seconds apart form one activity session. First/last activity refers only to screened events; raw requests remain in the timeline.
- Owner-only Ignore/Restore actions preserve original records. Other owners cannot inspect or modify events.
- Chrome's documented [declarative network rules](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) block direct pixel images initiated by Gmail under the extension's existing host access. This does not block Google's remote servers.
- The extension reports message identifiers seen in rendered Gmail images. Requests within five seconds are conservatively flagged possible self-views. This is correlation, not proof: it can exclude a coincident recipient load and miss views on other devices, cached loads, or opaque proxy URLs.
- Approximate location remains conditional on hosting metadata. An unavailable location is not replaced with an invented location or inferred employer.

## Validation

Real SQLite tests cover the 119ms five-message regression, counts/timeline agreement, later independent activity, deduplicated sessions, ignore/restore ownership, and narrow sender-view timing. Mocked InboxSDK tests verify payload insertion, no draft arming/body upload, outgoing send behavior, and reporting a rendered proxy image identifier. Type checking and production build are required before publication. No test fires real tracked production pixels or sends email.

Live Gmail acceptance remains necessary after installing 0.4.0: use an independent browser/device without the sender extension for the recipient; compare an untouched sent message, an intentional recipient view, and a sender Sent view. Gmail caching can prevent repeated loads. An image request alone is never proof that a specific person read the email.
