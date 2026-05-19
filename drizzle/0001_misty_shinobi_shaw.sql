ALTER TABLE "settings" ADD COLUMN "litellm_base_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "litellm_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "openrouter_key" text;