import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const book = pgTable('book', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  coverUrl: text('cover_url'),
  localPath: text('local_path').notNull(),
  hash: text('hash').unique(),
  minioKey: text('minio_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chapter = pgTable('chapter', {
  id: uuid('id').primaryKey().defaultRandom(),
  href: text('href').notNull(),
  title: text('title').notNull(),
  bookId: uuid('book_id').notNull().references(() => book.id, { onDelete: 'cascade' }),
});

export const translationCache = pgTable('translation_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalHtml: text('original_html').notNull(),
  translatedHtml: text('translated_html').notNull(),
  targetLanguage: text('target_language').notNull(),
  model: text('model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  id: text('id').primaryKey().default('default'),
  openaiKey: text('openai_key'),
  openaiBaseUrl: text('openai_base_url'),
  openaiKeys: text('openai_keys').array().default([]).notNull(),
  openaiModel: text('openai_model').default('deepseek-chat'),
  litellmBaseUrl: text('litellm_base_url'),
  litellmKeys: text('litellm_keys').array().default([]).notNull(),
  litellmModel: text('litellm_model').default('deepseek-chat'),
  openrouterKey: text('openrouter_key'),
  openrouterKeys: text('openrouter_keys').array().default([]).notNull(),
  openrouterModel: text('openrouter_model').default('deepseek/deepseek-chat'),
  mistralKey: text('mistral_key'),
  mistralKeys: text('mistral_keys').array().default([]).notNull(),
  mistralModel: text('mistral_model').default('mistral-large-latest'),
  defaultModel: text('default_model').default('gemini-2.5-flash'),
  maxRetries: integer('max_retries').default(3).notNull(),
  baseDelay: integer('base_delay').default(2000).notNull(),
  maxDelay: integer('max_delay').default(30000).notNull(),
  concurrencyLimit: integer('concurrency_limit').default(5).notNull(),
  proxyUrl: text('proxy_url'),
});

// Relations
export const bookRelations = relations(book, ({ many }) => ({
  chapters: many(chapter),
}));

export const chapterRelations = relations(chapter, ({ one }) => ({
  book: one(book, {
    fields: [chapter.bookId],
    references: [book.id],
  }),
}));
