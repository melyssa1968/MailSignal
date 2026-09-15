CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`excluded_domains` text DEFAULT '[]' NOT NULL,
	`extension_key_hash` text,
	`extension_seen_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_preferences_extension_key` ON `preferences` (`extension_key_hash`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `source` text DEFAULT 'campaign' NOT NULL;