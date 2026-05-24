ALTER TABLE "settings" ADD COLUMN "mistral_base_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mistral_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mistral_model" text DEFAULT 'mistral-large-latest';