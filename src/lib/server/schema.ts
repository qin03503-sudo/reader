import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const book = pgTable('book', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  coverUrl: text('cover_url'),
  localPath: text('local_path').notNull(),
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
  openRouterKey: text('openrouter_key'),
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
