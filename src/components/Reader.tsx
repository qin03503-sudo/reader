import React, { useState, useEffect, useRef } from 'react';
import { ParsedBook, getChapterHtml } from '../lib/epub';
import { translateHtmlBlock } from '../lib/gemini';
import { translationStore, progressStore, notesStore } from '../lib/db';
import { ChevronLeft, ChevronRight, Settings, BookOpen, Layers, Menu, Moon, Sun, X, MessageSquarePlus, AlignLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface ReaderProps {
  book: ParsedBook;
  bookId: string;
  globalModel: string;
  onClose: () => void;
}

function segmentChapterHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(doc.body.childNodes);
  const blocks: string[] = [];
  let currentGroup = document.createElement('div');

  nodes.forEach((node) => {
    if (node.nodeType === 1 && ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE'].includes((node as Element).tagName)) {
      if (currentGroup.innerHTML.trim()) {
        blocks.push(currentGroup.outerHTML);
        currentGroup = document.createElement('div');
      }
      blocks.push((node as Element).outerHTML);
    } else {
      currentGroup.appendChild(node.cloneNode(true));
    }
  });

  if (currentGroup.innerHTML.trim()) {
    blocks.push(currentGroup.outerHTML);
  }

  return blocks.filter(b => b.replace(/<[^>]*>/g, '').trim().length > 0 || b.includes('<img'));
}

export function Reader({ book, bookId, globalModel, onClose }: ReaderProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [translatedBlocks, setTranslatedBlocks] = useState<{ original: string, translated: string }[]>([]);
  const [targetLang, setTargetLang] = useState('Persian');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'|'sepia'>('light');
  
  const [hoveredSyncId, setHoveredSyncId] = useState<string | null>(null);
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [currentNote, setCurrentNote] = useState('');

  // Dual synchronous scrolling refs
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const [isScrollingLeft, setIsScrollingLeft] = useState(false);
  const [isScrollingRight, setIsScrollingRight] = useState(false);

  useEffect(() => {
    progressStore.getItem<{chapterIndex: number}>(bookId).then((saved) => {
      if (saved && saved.chapterIndex !== undefined) {
        setCurrentChapterIndex(saved.chapterIndex);
      }
    });
  }, [bookId]);

  useEffect(() => {
    async function loadChapter() {
      const chapter = book.chapters[currentChapterIndex];
      progressStore.setItem(bookId, { chapterIndex: currentChapterIndex });

      const notesKey = `notes_${bookId}_${currentChapterIndex}`;
      const savedNotes = await notesStore.getItem<Record<string, string>>(notesKey);
      if (savedNotes) setNotes(savedNotes);
      else setNotes({});

      const html = await getChapterHtml(book.zip, chapter.href);
      const segmented = segmentChapterHtml(html);
      setBlocks(segmented);
      
      setTranslatedBlocks(segmented.map(b => ({ original: b, translated: '<div class="h-6 w-1/2 bg-black/10 animate-pulse rounded mt-2"></div>' })));
    }
    loadChapter();
  }, [currentChapterIndex, book]);

  useEffect(() => {
    let isCancelled = false;

    async function processTranslations() {
      const cacheKeyPrefix = `trans_${bookId}_${book.chapters[currentChapterIndex].href}_${targetLang}_${globalModel}_`;
      
      for (let i = 0; i < blocks.length; i++) {
        if (isCancelled) break;
        const block = blocks[i];
        
        const textContent = block.replace(/<[^>]*>/g, '').trim();
        if (textContent.length === 0) {
          setTranslatedBlocks(prev => {
            const next = [...prev];
            next[i] = { original: block, translated: block }; 
            return next;
          });
          continue;
        }

        const cacheKey = cacheKeyPrefix + i;
        const cached = await translationStore.getItem<{original: string, translated: string}>(cacheKey);

        if (cached) {
          setTranslatedBlocks(prev => {
            const next = [...prev];
            next[i] = cached;
            return next;
          });
        } else {
          try {
            const res = await translateHtmlBlock(block, targetLang, globalModel);
            if (!isCancelled) {
              setTranslatedBlocks(prev => {
                const next = [...prev];
                next[i] = { original: res.originalHtml, translated: res.translatedHtml };
                return next;
              });
              await translationStore.setItem(cacheKey, { original: res.originalHtml, translated: res.translatedHtml });
            }
          } catch (e) {
             console.error("Translation block error", e);
          }
        }
      }
    }

    if (blocks.length > 0) {
      processTranslations();
    }

    return () => { isCancelled = true; };
  }, [blocks, targetLang, book, currentChapterIndex, bookId, globalModel]);

  const handleInteract = (e: React.MouseEvent, type: 'hover' | 'out' | 'click') => {
    const target = e.target as HTMLElement;
    const syncElement = target.closest('.sync-hover');
    if (syncElement) {
      const syncId = syncElement.getAttribute('data-sync-id');
      if (syncId) {
        if (type === 'hover') setHoveredSyncId(syncId);
        else if (type === 'out') setHoveredSyncId(null);
        else if (type === 'click') {
          setSelectedSyncId(syncId);
          setCurrentNote(notes[syncId] || '');
        }
      }
    }
  };

  const saveNote = async () => {
    if (selectedSyncId) {
      const updatedNotes = { ...notes };
      if (currentNote.trim() === '') {
        delete updatedNotes[selectedSyncId];
      } else {
        updatedNotes[selectedSyncId] = currentNote;
      }
      setNotes(updatedNotes);
      await notesStore.setItem(`notes_${bookId}_${currentChapterIndex}`, updatedNotes);
      setSelectedSyncId(null);
    }
  };

  // Sync scrolling logic
  const handleScrollLeft = () => {
    if (isScrollingRight || !leftPaneRef.current || !rightPaneRef.current) return;
    setIsScrollingLeft(true);
    const percentage = leftPaneRef.current.scrollTop / (leftPaneRef.current.scrollHeight - leftPaneRef.current.clientHeight);
    rightPaneRef.current.scrollTop = percentage * (rightPaneRef.current.scrollHeight - rightPaneRef.current.clientHeight);
    // clear block after scroll
    setTimeout(() => setIsScrollingLeft(false), 50);
  };

  const handleScrollRight = () => {
    if (isScrollingLeft || !leftPaneRef.current || !rightPaneRef.current) return;
    setIsScrollingRight(true);
    const percentage = rightPaneRef.current.scrollTop / (rightPaneRef.current.scrollHeight - rightPaneRef.current.clientHeight);
    leftPaneRef.current.scrollTop = percentage * (leftPaneRef.current.scrollHeight - leftPaneRef.current.clientHeight);
    setTimeout(() => setIsScrollingRight(false), 50);
  };

  const themeClasses = {
    light: {
      app: 'bg-paper text-ink',
      header: 'bg-white border-divider',
      footer: 'bg-white border-divider',
      pane: 'bg-paper',
      text: 'text-ink',
      accent: 'text-accent',
      divider: 'bg-divider',
      hover: 'var(--color-highlight)', // #fff9c4
      noteBg: 'rgba(255, 249, 196, 0.5)',
      noteBorder: '#d4af37' // dot indicator color
    },
    dark: {
      app: 'bg-[#1a1a1a] text-[#e0e0e0]',
      header: 'bg-[#111111] border-[#333]',
      footer: 'bg-[#111111] border-[#333]',
      pane: 'bg-[#1a1a1a]',
      text: 'text-[#e0e0e0]',
      accent: 'text-gray-400',
      divider: 'bg-[#333]',
      hover: 'rgba(255, 255, 0, 0.25)',
      noteBg: 'rgba(59, 130, 246, 0.15)',
      noteBorder: '#60a5fa'
    },
    sepia: {
      app: 'bg-[#f4ecd8] text-[#5b4636]',
      header: 'bg-[#ede0c8] border-[#dfcca4]',
      footer: 'bg-[#ede0c8] border-[#dfcca4]',
      pane: 'bg-[#f4ecd8]',
      text: 'text-[#5b4636]',
      accent: 'text-[#877059]',
      divider: 'bg-[#dfcca4]',
      hover: 'rgba(255, 255, 0, 0.4)',
      noteBg: 'rgba(255, 255, 0, 0.2)',
      noteBorder: '#d4af37'
    },
  };

  const currentTheme = themeClasses[theme];

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden transition-colors duration-300 relative", currentTheme.app)}>
      {/* Sidebar TOC Overlay */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
          <div className={cn("relative w-80 h-full shadow-2xl flex flex-col transition-transform transform", currentTheme.app, currentTheme.header)}>
            <div className="flex items-center justify-between p-6 border-b border-divider">
              <h2 className="font-playfair text-xl font-bold">Contents</h2>
              <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-black/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              {book.chapters.map((chap, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrentChapterIndex(i);
                    setSidebarOpen(false);
                  }}
                  className={cn("text-left px-4 py-3 rounded-md transition-colors font-medium text-sm", 
                    currentChapterIndex === i 
                      ? (theme === 'dark' ? 'bg-[#333] text-white' : 'bg-ink text-white') 
                      : (theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-black/5 text-ink/80')
                  )}
                >
                  {chap.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className={cn("flex h-[72px] shrink-0 items-center justify-between border-b px-6 z-10 transition-colors", currentTheme.header)}>
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-black/5 rounded-full transition-colors shrink-0" title="Table of Contents">
            <AlignLeft className="w-5 h-5" />
          </button>
          
          <div className="h-6 w-px bg-divider mx-1"></div>

          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors shrink-0" title="Back to Library">
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            {book.metadata.coverUrl && (
              <div className="w-[40px] h-[56px] bg-gray-200 rounded-[2px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] overflow-hidden shrink-0">
                <img src={book.metadata.coverUrl} alt="Cover" className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <h1 className="font-playfair text-[18px] m-0 leading-tight truncate max-w-[150px] md:max-w-xs">{book.metadata.title}</h1>
              <p className={cn("text-[12px] m-0 truncate max-w-[150px] md:max-w-xs", currentTheme.accent)}>{book.metadata.author} · {book.chapters[currentChapterIndex]?.title}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 border rounded-[4px] text-[12px] cursor-pointer", theme === 'light' ? 'text-accent border-divider bg-white' : 'border-current opacity-80')}>
            <span className="font-medium">Lang:</span>
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="Persian">Persian (فارسی)</option>
              <option value="Arabic">Arabic</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>
          
          <button 
            onClick={() => setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'sepia' : 'light')} 
            className="p-2 hover:bg-black/5 rounded-full transition-colors shrink-0"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5"/> : theme === 'dark' ? <Settings className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content: Split Pane */}
      <div className={cn("flex flex-1 overflow-hidden relative", currentTheme.pane)}>
        {/* Center Divider */}
        <div className={cn("hidden md:block absolute left-1/2 top-10 bottom-10 w-[1px] z-10", currentTheme.divider)}></div>
        
        {/* Left: Original */}
        <div 
          ref={leftPaneRef}
          onScroll={handleScrollLeft}
          className="flex-1 overflow-y-auto w-1/2 p-6 md:p-12 scroll-smooth scrollbar-hide"
          onMouseOver={(e) => handleInteract(e, 'hover')}
          onMouseOut={(e) => handleInteract(e, 'out')}
          onClick={(e) => handleInteract(e, 'click')}
        >
          <div className="max-w-2xl ml-auto mr-0 md:mr-12 space-y-6 font-serif-book text-[18px] leading-[1.75] text-justify">
            {translatedBlocks.map((b, i) => (
              <div 
                key={`orig-${i}`} 
                className="[&_.sync-hover]:transition-colors [&_.sync-hover]:duration-200 [&_.sync-hover]:cursor-pointer [&_.sync-hover]:py-px"
                dangerouslySetInnerHTML={{ __html: b.original }} 
              />
            ))}
          </div>
        </div>

        {/* Right: Translated */}
        <div 
          ref={rightPaneRef}
          onScroll={handleScrollRight}
          className="flex-1 overflow-y-auto w-1/2 p-6 md:p-12 dir-auto scroll-smooth scrollbar-hide"
          onMouseOver={(e) => handleInteract(e, 'hover')}
          onMouseOut={(e) => handleInteract(e, 'out')}
          onClick={(e) => handleInteract(e, 'click')}
          dir={targetLang === 'Persian' || targetLang === 'Arabic' ? 'rtl' : 'ltr'}
        >
          <div className={cn("max-w-2xl mr-auto ml-0 md:ml-12 space-y-6 text-[19px] leading-[1.75] text-justify", 
            targetLang === 'Persian' || targetLang === 'Arabic' ? "font-vazirmatn" : "font-serif-book"
          )}>
            {translatedBlocks.map((b, i) => (
              <div 
                key={`trans-${i}`} 
                className="[&_.sync-hover]:transition-colors [&_.sync-hover]:duration-200 [&_.sync-hover]:cursor-pointer [&_.sync-hover]:py-px"
                dangerouslySetInnerHTML={{ __html: b.translated }} 
              />
            ))}
          </div>
        </div>

        {/* Notes Sidebar / Modal Overlay */}
        {selectedSyncId && (
          <div className="absolute top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl border-l border-black/10 z-20 flex flex-col transform transition-transform">
            <div className="flex items-center justify-between p-4 border-b border-black/10">
              <h3 className="font-medium flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4" /> Add Note
              </h3>
              <button onClick={() => setSelectedSyncId(null)} className="p-1 hover:bg-black/5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-4">
              <p className="text-sm opacity-70">Adding a note to the selected sentence...</p>
              <textarea 
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                placeholder="Type your notes here..."
                className="w-full h-48 p-3 border border-black/20 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                autoFocus
              />
              <button 
                onClick={saveNote}
                className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
              >
                Save Note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <footer className={cn("flex h-[48px] shrink-0 items-center justify-between border-t px-6 z-10 text-[12px] transition-colors", currentTheme.footer, currentTheme.accent)}>
        <div className="flex items-center gap-2 font-medium">
          <span className={cn("w-2 h-2 rounded-full", translatedBlocks.some(b => b.translated.includes('animate-pulse')) ? 'bg-orange-400 animate-pulse' : (theme === 'dark' ? 'bg-blue-400' : 'bg-[#4caf50]'))}></span> 
          <span>{translatedBlocks.some(b => b.translated.includes('animate-pulse')) ? 'AI Translating...' : 'AI Connected'} · Progress: {book.chapters.length > 0 ? Math.round(((currentChapterIndex + 1) / book.chapters.length) * 100) : 0}% (Chapter {currentChapterIndex + 1} of {book.chapters.length})</span>
        </div>
        
        <div className="flex items-center gap-2 flex-row-reverse">
          <button 
            onClick={() => setCurrentChapterIndex(i => Math.min(book.chapters.length - 1, i + 1))}
            disabled={currentChapterIndex === book.chapters.length - 1}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 border rounded-[4px] bg-transparent hover:bg-black/5 disabled:opacity-30 transition-colors", theme === 'light' ? 'border-divider' : 'border-current opacity-80')}
          >
            <span>Next</span> <ChevronRight className="w-3.5 h-3.5" />
          </button>
          
          <button 
            onClick={() => setCurrentChapterIndex(i => Math.max(0, i - 1))}
            disabled={currentChapterIndex === 0}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 border rounded-[4px] bg-transparent hover:bg-black/5 disabled:opacity-30 transition-colors", theme === 'light' ? 'border-divider' : 'border-current opacity-80')}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> <span>Previous</span>
          </button>
        </div>
      </footer>

      {/* Global CSS for sync hover effect */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .sync-hover[data-sync-id="${hoveredSyncId}"] {
          background-color: ${currentTheme.hover};
          color: ${theme === 'dark' ? '#fff' : 'inherit'};
        }

        /* Highlight sentences that have notes attached */
        ${Object.keys(notes).map(id => `
          .sync-hover[data-sync-id="${id}"] {
            background-color: ${currentTheme.noteBg};
            position: relative;
          }
          .sync-hover[data-sync-id="${id}"]::after {
            content: '';
            position: absolute;
            top: -2px;
            right: -4px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: ${currentTheme.noteBorder};
          }
        `).join('\n')}

        /* Note selection override */
        .sync-hover[data-sync-id="${selectedSyncId}"] {
          background-color: ${currentTheme.hover} !important;
        }

        .font-vazirmatn {
          font-family: 'Vazirmatn', system-ui, sans-serif;
        }
        
        img { 
          max-width: 100%; 
          height: auto; 
          border-radius: 2px; 
          margin: 2rem auto; 
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 2rem 0;
        }
        
        th, td {
          border: 1px solid rgba(128, 128, 128, 0.2);
          padding: 0.75rem;
        }
      `}</style>
    </div>
  );
}
