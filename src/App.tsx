import { useState, useEffect } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { ParsedBook, parseEpub } from './lib/epub';
import { bookStore, libraryStore } from './lib/db';

export default function App() {
  const [book, setBook] = useState<{ parsed: ParsedBook, id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalModel, setGlobalModel] = useState<string>('gemini-2.5-flash');

  // We no longer auto-load the 'current_book' directly. We just show the library.
  // Unless we want to remember the LAST read book. Let's just default to Library view.
  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fcfaf7]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <Library 
        onOpenBook={(parsed, id) => setBook({ parsed, id })} 
        globalModel={globalModel}
        onChangeModel={setGlobalModel}
      />
    );
  }

  return (
    <Reader 
      book={book.parsed} 
      bookId={book.id} 
      onClose={() => setBook(null)} 
      globalModel={globalModel} 
    />
  );
}


