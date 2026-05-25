ALTER TABLE "settings" ADD COLUMN "openrouter_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mistral_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "gemini_keys" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "translation_cache" ADD COLUMN "original_html_with_spans" text;