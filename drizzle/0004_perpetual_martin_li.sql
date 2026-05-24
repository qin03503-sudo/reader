ALTER TABLE "settings" ADD COLUMN "mistral_key" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mistral_model" text DEFAULT 'mistral-large-latest';