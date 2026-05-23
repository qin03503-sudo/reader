ALTER TABLE "book" ADD COLUMN "hash" text;--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "minio_key" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "openai_model" text DEFAULT 'deepseek-chat';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "litellm_model" text DEFAULT 'deepseek-chat';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "openrouter_model" text DEFAULT 'deepseek/deepseek-chat';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_model" text DEFAULT 'gemini-2.5-flash';--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_hash_unique" UNIQUE("hash");