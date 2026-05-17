import React, { useState, useEffect } from 'react';
import { Upload, Book as BookIcon, Trash2, Settings, Play } from 'lucide-react';
import { parseEpub, ParsedBook, BookMetadata } from '../lib/epub';
import { bookStore, libraryStore, translationStore, progressStore, notesStore, settingsStore } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { SettingsModal, AppSettings } from './SettingsModal';

export interface LibraryItem {
  id: string;
  metadata: BookMetadata;
  addedAt: number;
}

interface LibraryProps {
  onOpenBook: (book: ParsedBook, bookId: string) => void;
  globalModel: string;
  onChangeModel: (model: string) => void;
}

export function Library({ onOpenBook, globalModel, onChangeModel }: LibraryProps) {
  const [books, setBooks] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customModels, setCustomModels] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    loadLibrary();
    loadSettings();
  }, []);

  const loadLibrary = async () => {
    const keys = await libraryStore.keys();
    const loadedBooks: LibraryItem[] = [];
    for (const key of keys) {
      const item = await libraryStore.getItem<LibraryItem>(key);
      if (item) loadedBooks.push(item);
    }
    loadedBooks.sort((a, b) => b.addedAt - a.addedAt);
    setBooks(loadedBooks);
  };

  const loadSettings = async () => {
    const saved = await settingsStore.getItem<AppSettings>('app_settings');
    if (saved && saved.customModels) {
      setCustomModels(saved.customModels);
      
      // If globalModel is empty or not in the list, we don't necessarily reset it, but it's good to keep track.
    }
  };

  const processFile = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      const buffer = await file.arrayBuffer();
      const parsed = await parseEpub(buffer);
      
      const newId = uuidv4();
      const libraryItem: LibraryItem = {
        id: newId,
        metadata: parsed.metadata,
        addedAt: Date.now()
      };

      await bookStore.setItem(newId, buffer);
      await libraryStore.setItem(newId, libraryItem);
      
      await loadLibrary();
      onOpenBook(parsed, newId);
    } catch (err) {
      console.error(err);
      setError('Failed to parse EPUB file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleOpen = async (item: LibraryItem) => {
    setLoading(true);
    try {
      const buffer = await bookStore.getItem<ArrayBuffer>(item.id);
      if (buffer) {
        const parsed = await parseEpub(buffer);
        onOpenBook(parsed, item.id);
      } else {
        setError('Book data not found. It might have been cleared.');
      }
    } catch(err) {
      setError('Error opening book.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this book and all its cached translations?')) return;
    
    await libraryStore.removeItem(id);
    await bookStore.removeItem(id);
    // Find keys in translationStore that start with this book title and remove them
    const tKeys = await translationStore.keys();
    // Getting metadata to find the prefix
    const itemInfo = books.find(b => b.id === id);
    if (itemInfo) {
      const pKey = itemInfo.metadata.title;
      for (const tKey of tKeys) {
        if (tKey.startsWith(pKey)) {
          await translationStore.removeItem(tKey);
        }
      }
      await progressStore.removeItem(pKey);
      
      // Remove notes
      const nKeys = await notesStore.keys();
      for (const nKey of nKeys) {
        if (nKey.startsWith(`notes_${pKey}`)) {
          await notesStore.removeItem(nKey);
        }
      }
    }
    
    await loadLibrary();
  };

  return (
    <div className="flex flex-col min-h-screen bg-paper font-inter">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-divider px-8 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1a1a1a] rounded flex items-center justify-center text-white">
            <BookIcon className="w-5 h-5" />
          </div>
          <h1 className="font-playfair text-[20px] font-bold text-ink">Bilingual AI Reader</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-black/5 text-accent transition-colors"
            title="API Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 text-sm text-accent max-w-[250px]">
            <span>Model:</span>
            <select 
              value={globalModel}
              onChange={(e) => onChangeModel(e.target.value)}
              className="bg-transparent border border-divider rounded px-2 py-1 outline-none font-medium text-ink truncate max-w-full"
            >
              <optgroup label="Default (Gemini API)">
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </optgroup>
              
              {customModels.length > 0 && (
                <optgroup label="Custom OpenAI API">
                  {customModels.map(m => (
                    <option key={m.id} value={`custom:${m.id}`}>{m.id}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-8 flex flex-col md:flex-row gap-12">
        {/* Left column: Upload area based on "Clean Minimalism" style */}
        <div className="w-full md:w-1/3 flex flex-col pt-4">
          <h2 className="text-xl font-playfair font-bold text-ink mb-6">Add New Book</h2>
          
          <div 
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-divider bg-white/50 rounded-lg p-10 text-center transition-colors hover:border-accent hover:bg-white cursor-pointer"
          >
            <div className="mb-4 rounded-full bg-paper p-4 border border-divider">
              <Upload className="h-6 w-6 text-accent" />
            </div>
            <h3 className="mb-2 text-base font-medium text-ink">Upload EPUB File</h3>
            <p className="mb-6 text-xs text-accent">Drag & drop or click</p>
            
            <label className="cursor-pointer rounded border border-ink bg-ink px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333]">
              Browse Files
              <input 
                type="file" 
                accept=".epub" 
                className="hidden" 
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              />
            </label>

            {loading && <p className="mt-4 text-sm text-ink animate-pulse">Processing book...</p>}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-8 p-6 bg-[#f4ecd8] border border-[#dfcca4] rounded-lg">
            <h3 className="text-sm font-bold text-[#5b4636] mb-2 flex items-center gap-2">
              <BookIcon className="w-4 h-4"/> How it works
            </h3>
            <ul className="text-xs text-[#877059] space-y-2 list-disc pl-4">
              <li>Upload an EPUB document locally.</li>
              <li>Books and translations are cached offline in your browser.</li>
              <li>Only the currently viewed page is translated via AI.</li>
              <li>Sentence alignments are generated dynamically.</li>
            </ul>
          </div>
        </div>

        {/* Right column: Library list */}
        <div className="w-full md:w-2/3 flex flex-col pt-4">
          <h2 className="text-xl font-playfair font-bold text-ink mb-6">My Library</h2>
          
          {books.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-divider rounded-lg bg-white/30 p-12 text-accent text-sm">
              Your library is empty. Upload a book to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {books.map(book => (
                <div 
                  key={book.id}
                  onClick={() => handleOpen(book)}
                  className="group relative flex gap-4 p-4 border border-divider rounded-lg bg-white cursor-pointer transition hover:border-ink hover:shadow-md"
                >
                  <div className="w-16 h-24 bg-paper border border-divider rounded flex-shrink-0 overflow-hidden shadow-sm">
                    {book.metadata.coverUrl ? (
                      <img src={book.metadata.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-accent/50 text-[10px] text-center p-1">
                        <BookIcon className="w-6 h-6 mb-1 opacity-20" />
                        No Cover
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col flex-1 py-1 overflow-hidden">
                    <h3 className="font-playfair font-bold text-ink text-base mb-1 truncate leading-tight">
                      {book.metadata.title}
                    </h3>
                    <p className="text-xs text-accent truncate mb-auto">
                      {book.metadata.author}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-accent">
                      <span>Added {new Date(book.addedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button 
                      onClick={(e) => handleDelete(e, book.id)}
                      className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors"
                      title="Delete Book"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center shadow-md">
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onSettingsSaved={loadSettings}
        />
      )}
    </div>
  );
}
