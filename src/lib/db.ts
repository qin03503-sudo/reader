import localforage from 'localforage';

localforage.config({
  name: 'BilingualAIReader',
  storeName: 'reader_data',
});

// Cache for storing original EPUB array buffers by book ID
export const bookStore = localforage.createInstance({
  name: 'BilingualAIReader',
  storeName: 'books'
});

// Cache for storing app settings (like API keys, base URLs)
export const settingsStore = localforage.createInstance({
  name: 'BilingualAIReader',
  storeName: 'settings'
});
export const libraryStore = localforage.createInstance({
  name: 'BilingualAIReader',
  storeName: 'library'
});

// Cache for storing AI translations
export const translationStore = localforage.createInstance({
  name: 'BilingualAIReader',
  storeName: 'translations'
});

// Cache for user notes and highlights
export const notesStore = localforage.createInstance({
  name: 'BilingualAIReader',
  storeName: 'notes'
});

// Cache for reading progress
export const progressStore = localforage.createInstance({
  name: 'BilingualAIReader',
  storeName: 'progress'
});

