CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`parent_response_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`question_text` text NOT NULL,
	`rationale` text,
	`depth` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text DEFAULT '👤' NOT NULL,
	`color` text DEFAULT '#6366F1' NOT NULL,
	`demographics` text,
	`goals` text,
	`pain_points` text,
	`tech_comfort` text DEFAULT 'medium' NOT NULL,
	`behavioural_traits` text,
	`communication_style` text,
	`system_prompt_fragment` text NOT NULL,
	`is_preset` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`question_text` text NOT NULL,
	`assigned_persona_ids` text NOT NULL,
	`expected_turn_type` text DEFAULT 'single' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `research_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`filename` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`label` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `plan_questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `report_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text NOT NULL,
	`section_key` text NOT NULL,
	`order_index` integer NOT NULL,
	`content` text NOT NULL,
	`structured_output` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `studies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `research_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `studies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`persona_name` text NOT NULL,
	`kind` text DEFAULT 'initial' NOT NULL,
	`parent_response_id` text,
	`question_asked` text NOT NULL,
	`response_text` text NOT NULL,
	`structured_output` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text NOT NULL,
	`persona_id` text,
	`persona_snapshot` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`summary` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `studies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studies` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`problem_statement` text NOT NULL,
	`research_goals` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`session_mode` text DEFAULT 'one_on_one' NOT NULL,
	`config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`extracted_text` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `studies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `synthesis` (
	`id` text PRIMARY KEY NOT NULL,
	`study_id` text,
	`session_id` text,
	`turn_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`structured_output` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `studies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`plan_question_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`synthesis_text` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_question_id`) REFERENCES `plan_questions`(`id`) ON UPDATE no action ON DELETE no action
);
