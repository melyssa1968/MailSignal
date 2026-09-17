ALTER TABLE `messages` ADD `recipients_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `sender` text;