ALTER TABLE "settings" ADD COLUMN "max_retries" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "base_delay" integer DEFAULT 2000 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "max_delay" integer DEFAULT 30000 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "concurrency_limit" integer DEFAULT 5 NOT NULL;