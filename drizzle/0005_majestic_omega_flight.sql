CREATE TABLE `source_cache` (
	`ip` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_source_cache_expiry` ON `source_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `tracked_links` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tracked_links_message` ON `tracked_links` (`message_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `event_type` text DEFAULT 'pixel' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `link_id` text;