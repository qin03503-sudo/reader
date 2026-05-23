import re

with open('src/lib/components/Reader.svelte', 'r') as f:
    content = f.read()

load_chapter_old = """  async function loadChapter() {
    if (!chapter) return;
    loading = true;
    error = '';
    htmlContent = '';

    try {
      const res = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(chapter.href)}`);
      const data = await res.json();
      if (res.ok) {
        htmlContent = data.html;
      } else {
        error = data.error;
      }
    } catch (e) {
      error = 'Failed to load chapter';
    } finally {
      loading = false;
      attachEventListeners();
    }
  }"""

load_chapter_new = """  async function loadChapter() {
    if (!chapter) return;
    loading = true;
    error = '';
    htmlContent = '';
    translatedContent = '';
    translationError = '';

    try {
      const res = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(chapter.href)}`);
      const data = await res.json();
      if (res.ok) {
        htmlContent = data.html;
        // Start translation
        translateChapter(data.html);
      } else {
        error = data.error;
      }
    } catch (e) {
      error = 'Failed to load chapter';
    } finally {
      loading = false;
    }
  }

  async function translateChapter(sourceHtml: string) {
      translationLoading = true;
      translationError = '';
      try {
          const res = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  html: sourceHtml,
                  targetLanguage,
                  model: selectedModel,
                  bookTitle: book?.title,
                  chapterTitle: chapter?.title
              })
          });
          const data = await res.json();
          if (res.ok) {
              htmlContent = data.originalHtml; // Contains spans
              translatedContent = data.translatedHtml; // Contains spans
          } else {
              translationError = data.error || 'Translation failed';
          }
      } catch (e) {
          translationError = 'Failed to connect to translation service';
      } finally {
          translationLoading = false;
          attachEventListeners();
      }
  }"""

content = content.replace(load_chapter_old, load_chapter_new)

with open('src/lib/components/Reader.svelte', 'w') as f:
    f.write(content)
