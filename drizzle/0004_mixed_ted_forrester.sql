-- One-time reset requested when accounts launch: all earlier data was test data created without real accounts.
DELETE FROM `transactions`;--> statement-breakpoint
DELETE FROM `payment_authorizations`;--> statement-breakpoint
DELETE FROM `reward_choices`;--> statement-breakpoint
DELETE FROM `activity_logs`;--> statement-breakpoint
DELETE FROM `participants`;--> statement-breakpoint
DELETE FROM `challenges`;--> statement-breakpoint
DELETE FROM `users`;--> statement-breakpoint
CREATE TABLE `login_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` integer;