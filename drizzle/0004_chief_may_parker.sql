CREATE TABLE `sender_views` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`observed_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sender_views_message_time` ON `sender_views` (`message_id`,`observed_at`);--> statement-breakpoint
ALTER TABLE `events` ADD `ignored_at` integer;