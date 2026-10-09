CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`day` integer NOT NULL,
	`steps` integer NOT NULL,
	`active_minutes` integer NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_challenge_user_day` ON `activity_logs` (`challenge_id`,`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`duration_days` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`started_at` integer,
	`settled_at` integer,
	`winner_user_id` text,
	`loser_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenges_invite_code_unique` ON `challenges` (`invite_code`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_challenge_user` ON `participants` (`challenge_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `payment_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_ref` text NOT NULL,
	`spending_ceiling_cents` integer NOT NULL,
	`currency` text DEFAULT 'SGD' NOT NULL,
	`valid_until` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_auth_challenge_user` ON `payment_authorizations` (`challenge_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `reward_choices` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`product_id` text NOT NULL,
	`merchant` text NOT NULL,
	`product_name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'SGD' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_choices_unique_tier` ON `reward_choices` (`challenge_id`,`user_id`,`tier`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`payer_user_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`reward_choice_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`amount_cents` integer,
	`currency` text DEFAULT 'SGD' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_ref` text,
	`checkout_url` text,
	`failure_reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reward_choice_id`) REFERENCES `reward_choices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_idempotency_key_unique` ON `transactions` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);