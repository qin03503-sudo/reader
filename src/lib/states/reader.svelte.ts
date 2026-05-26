export function createReaderState() {
  let book = $state<any>(null);
  let globalModel = $state('gemini-2.5-flash');
  let currentPageIndex = $state(0);
  let targetPageIndex = $state(0);
  let currentTranslationId = $state(0);
  let currentChapterIndex = $state(0);
  let originalRenderParts = $state<string[]>([]);
  let translatedRenderParts = $state<string[]>([]);
  let loading = $state(false);
  let error = $state('');
  let translationLoading = $state(false);
  let translationError = $state('');
  let translateProgressText = $state('Preparing translation...');
  let totalTranslationParts = $state(0);
  let completedTranslationParts = $state(0);
  let selectedModel = $state('gemini-2.5-flash');
  let targetLanguage = $state('fa');

  const prefetchedTranslations = new Map<number, { originalParts: string[]; translatedParts: string[] }>();

  let chapter = $derived(book?.chapters?.[currentChapterIndex]);
  let totalPages = $derived(originalRenderParts.length);


  function nextPage() {
    if (currentPageIndex < totalPages - 1) {
      currentPageIndex++;
    } else if (book?.chapters && currentChapterIndex < book.chapters.length - 1) {
      currentChapterIndex++;
      currentPageIndex = 0;
    }
  }

  function previousPage() {
    if (currentPageIndex > 0) {
      currentPageIndex--;
    } else if (currentChapterIndex > 0) {
      currentChapterIndex--;
      targetPageIndex = -1;
    }
  }

  function splitHtmlIntoClientParts(html: string, maxPartLength = 1200): string[] {
    const blockRegex = /(<(?:p|div|section|article|blockquote|h[1-6]|li|pre|code|table|figure)[^>]*>[\s\S]*?<\/(?:p|div|section|article|blockquote|h[1-6]|li|pre|code|table|figure)>)/gi;
    const blocks = html.match(blockRegex);
    if (!blocks || blocks.length === 0) return [html];
    const parts: string[] = [];
    let current = '';
    for (const block of blocks) {
      if (current.length > 0 && current.length + block.length > maxPartLength) {
        parts.push(current);
        current = block;
      } else {
        current += block;
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  async function translateChapter(parts: string[]) {
    currentTranslationId++;
    const myTranslationId = currentTranslationId;
    translationLoading = true;
    translateProgressText = 'Preparing translation…';
    translationError = '';
    completedTranslationParts = 0;
    try {
      totalTranslationParts = parts.length;
      translatedRenderParts = []; // Clear current translations before starting

      for (let i = 0; i < parts.length; i++) {
        translateProgressText = `Translating part ${i + 1} of ${parts.length}…`;
        const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: parts[i],
                targetLanguage,
                model: selectedModel,
                bookTitle: book?.title,
                chapterTitle: chapter?.title
            })
        });
        const data = await res.json();
        if (!res.ok) {
          translationError = data.error || `Translation failed on part ${i + 1}`;
          break;
        }

        // Prefix sync ids to avoid collisions across parts
        if (myTranslationId !== currentTranslationId) return;
        const prefixIds = (html: string) => html.replace(/data-sync-id="([^"]+)"/g, `data-sync-id="${i}_$1"`);
        originalRenderParts[i] = prefixIds(data.originalHtml);
        translatedRenderParts.push(prefixIds(data.translatedHtml));

        completedTranslationParts = i + 1;
      }
    } catch (e) {
        translationError = 'Failed to connect to translation service';
    } finally {
        translationLoading = false;
    }
  }

  async function prefetchNextChapter() {
    const nextIndex = currentChapterIndex + 1;
    const nextChapter = book?.chapters?.[nextIndex];
    if (!nextChapter || prefetchedTranslations.has(nextIndex)) return;

    try {
      const chapterRes = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(nextChapter.href)}`);
      if (!chapterRes.ok) return;
      const chapterData = await chapterRes.json();

      const parts = splitHtmlIntoClientParts(chapterData.html, 800);
      const translatedParts: string[] = [];
      const originalParts: string[] = [];

      for (let i = 0; i < parts.length; i++) {
        const translateRes = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: parts[i],
            targetLanguage,
            model: selectedModel,
            bookTitle: book?.title,
            chapterTitle: nextChapter?.title
          })
        });

        if (!translateRes.ok) return;
        const translated = await translateRes.json();

        const prefixIds = (html: string) => html.replace(/data-sync-id="([^"]+)"/g, `data-sync-id="${i}_$1"`);
        originalParts.push(prefixIds(translated.originalHtml));
        translatedParts.push(prefixIds(translated.translatedHtml));
      }

      prefetchedTranslations.set(nextIndex, {
        originalParts,
        translatedParts
      });
    } catch {
        // Silent background prefetch failure.
    }
  }

  async function loadChapter() {
    if (!chapter) return;
    loading = true;
    error = '';
    originalRenderParts = [];
    translatedRenderParts = [];
    translationError = '';

    try {
      const res = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(chapter.href)}`);
      const data = await res.json();
      if (res.ok) {
        originalRenderParts = splitHtmlIntoClientParts(data.html, 1200);
        if (targetPageIndex === -1) {
          currentPageIndex = Math.max(0, originalRenderParts.length - 1);
          targetPageIndex = 0;
        } else {
          currentPageIndex = 0;
        }
        const prefetched = prefetchedTranslations.get(currentChapterIndex);
        if (prefetched) {
          originalRenderParts = [...prefetched.originalParts];
          translatedRenderParts = [...prefetched.translatedParts];
          translationLoading = false;
          prefetchedTranslations.delete(currentChapterIndex);
        } else {
          translateChapter(originalRenderParts);
        }
        prefetchNextChapter();
      } else {
        error = data.error || 'Failed to load chapter content';
      }
    } catch (e) {
      error = 'Failed to load chapter';
    } finally {
      loading = false;
    }
  }

  return {
    get book() { return book; },
    set book(val) { book = val; },
    get globalModel() { return globalModel; },
    set globalModel(val) { globalModel = val; },
    get currentChapterIndex() { return currentChapterIndex; },
    get currentPageIndex() { return currentPageIndex; },
    set currentPageIndex(val) { currentPageIndex = val; },
    get totalPages() { return totalPages; },
    nextPage,
    previousPage,
    set currentChapterIndex(val) { currentChapterIndex = val; },
    get originalRenderParts() { return originalRenderParts; },
    get translatedRenderParts() { return translatedRenderParts; },
    get loading() { return loading; },
    get error() { return error; },
    get translationLoading() { return translationLoading; },
    get translationError() { return translationError; },
    get translateProgressText() { return translateProgressText; },
    get totalTranslationParts() { return totalTranslationParts; },
    get completedTranslationParts() { return completedTranslationParts; },
    get selectedModel() { return selectedModel; },
    set selectedModel(val) { selectedModel = val; },
    get targetLanguage() { return targetLanguage; },
    set targetLanguage(val) { targetLanguage = val; },
    get chapter() { return chapter; },
    loadChapter
  };
}
