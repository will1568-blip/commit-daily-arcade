CREATE TABLE `challenges` (
	`phone_key` text PRIMARY KEY NOT NULL,
	`next_send_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`verification_sid` text
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `periods` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`period_key` text NOT NULL,
	`ends_at` integer NOT NULL,
	`finalize_after` integer NOT NULL,
	`finalized_at` integer,
	`prize_rules` text
);
--> statement-breakpoint
CREATE INDEX `periods_finalization` ON `periods` (`finalized_at`,`finalize_after`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_phone_unique` ON `players` (`phone_key`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game` text NOT NULL,
	`day` text NOT NULL,
	`week` text NOT NULL,
	`request_key` text NOT NULL,
	`started_at` integer NOT NULL,
	`submit_by` integer NOT NULL,
	`config` text NOT NULL,
	`status` text NOT NULL,
	`score` integer,
	`end_reason` text,
	`ended_at` integer,
	`trace` text,
	`trace_hash` text,
	`display_name` text NOT NULL,
	`rejection` text,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runs_one_per_day` ON `runs` (`user_id`,`game`,`day`);--> statement-breakpoint
CREATE UNIQUE INDEX `runs_start_idempotency` ON `runs` (`user_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `runs_day_scores` ON `runs` (`game`,`day`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `runs_week_scores` ON `runs` (`game`,`week`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `runs_expiry` ON `runs` (`status`,`submit_by`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `standings` (
	`period_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`score` integer NOT NULL,
	`rank` integer NOT NULL,
	`run_id` text NOT NULL,
	FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `standings_period_user` ON `standings` (`period_id`,`user_id`);