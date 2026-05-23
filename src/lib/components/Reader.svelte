<script lang="ts">
  import { ArrowLeft, BookOpen, Settings, X } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';

  let { book = null, globalModel = 'gemini-2.5-flash' }: { book?: any, globalModel?: string } = $props();
  
  const dispatch = createEventDispatcher();
  
  let currentChapterIndex = $state(0);
  let htmlContent = $state('');
  let translatedContent = $state('');
  let translationLoading = $state(false);
  let loading = $state(true);
  let error = $state('');
  let translationError = $state('');
  let showModelSettings = $state(false);
  let selectedLanguage = $state('fa');
  let targetLanguage = $state('fa');
  let originalContainer = $state<HTMLDivElement | null>(null);
  let translatedContainer = $state<HTMLDivElement | null>(null);
  let selectedModel = $state('gemini-2.5-flash');
  let settings = $state<any>(null);
  let translateProgressText = $state('Preparing translation…');
  let totalTranslationParts = $state(0);
  let completedTranslationParts = $state(0);
  const prefetchedTranslations = new Map<number, { originalHtml: string; translatedHtml: string }>();

  // Analysis / Dictionary state
  let showAnalysis = $state(false);
  let analysisLoading = $state(false);
  let analysisData = $state<any>(null);
  let analysisError = $state('');

  let chapter = $derived(book?.chapters?.[currentChapterIndex]);

  let models = $derived.by(() => {
    const list: { id: string; name: string }[] = [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ];
    if (settings?.openaiBaseUrl && settings?.openaiModel) {
      list.push({ id: 'custom', name: `Custom OpenAI (${settings.openaiModel})` });
    }
    if (settings?.litellmBaseUrl && settings?.litellmModel) {
      list.push({ id: 'litellm', name: `LiteLLM (${settings.litellmModel})` });
    }
    if (settings?.openrouterKey && settings?.openrouterModel) {
      list.push({ id: 'openrouter', name: `OpenRouter (${settings.openrouterModel})` });
    }
    return list;
  });

  async function loadChapter() {
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
        const prefetched = prefetchedTranslations.get(currentChapterIndex);
        if (prefetched) {
          htmlContent = prefetched.originalHtml;
          translatedContent = prefetched.translatedHtml;
          translationLoading = false;
          prefetchedTranslations.delete(currentChapterIndex);
        } else {
          translateChapter(data.html);
        }
        prefetchNextChapter();
      } else {
        error = data.error;
      }
    } catch (e) {
      error = 'Failed to load chapter';
    } finally {
      loading = false;
    }
  }

  function splitHtmlIntoClientParts(html: string, maxPartLength = 600): string[] {
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


  function rewriteSyncIds(html: string, partIndex: number): string {
    return html.replace(/data-sync-id="([^"]+)"/g, `data-sync-id="${partIndex}_$1"`);
  }

  async function translateChapter(sourceHtml: string) {
      translationLoading = true;
      translateProgressText = 'Preparing translation…';
      translationError = '';
      translatedContent = '';
      completedTranslationParts = 0;
      try {
          const parts = splitHtmlIntoClientParts(sourceHtml, 600);
          totalTranslationParts = parts.length;
          const translatedParts: string[] = [];
          const originalParts: string[] = [];

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

            const rewrittenOriginal = rewriteSyncIds(data.originalHtml, i);
            const rewrittenTranslated = rewriteSyncIds(data.translatedHtml, i);

            originalParts.push(rewrittenOriginal);
            translatedParts.push(rewrittenTranslated);
            completedTranslationParts = i + 1;
            htmlContent = originalParts.join('');
            translatedContent = translatedParts.join('');
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
          const translateRes = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  html: chapterData.html,
                  targetLanguage,
                  model: selectedModel,
                  bookTitle: book?.title,
                  chapterTitle: nextChapter?.title
              })
          });
          if (!translateRes.ok) return;
          const translated = await translateRes.json();
          prefetchedTranslations.set(nextIndex, {
              originalHtml: translated.originalHtml,
              translatedHtml: translated.translatedHtml
          });
      } catch {
          // Silent background prefetch failure.
      }
  }

  onMount(async () => {
    selectedModel = globalModel || 'gemini-2.5-flash';
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        settings = await res.json();
      }
    } catch(e) {
      showToast('error', 'Failed to load settings');
    }
  });

  $effect(() => {
    if (chapter) loadChapter();
  });

  $effect(() => {
    if (originalContainer || translatedContainer) {
       attachEventListeners();
    }
  });

  let listenersAttached = false;
  function attachEventListeners() {
    if (listenersAttached) return;
    if (!originalContainer || !translatedContainer) return;
    listenersAttached = true;
    setTimeout(() => {
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const syncId = target.getAttribute('data-sync-id');
                if (syncId && originalContainer && translatedContainer) {
                    const originalEl = originalContainer.querySelector(`[data-sync-id="${syncId}"]`) as HTMLElement;
                    const translatedEl = translatedContainer.querySelector(`[data-sync-id="${syncId}"]`) as HTMLElement;

                    if (originalEl) originalEl.classList.add('active');
                    if (translatedEl) translatedEl.classList.add('active');

                    const counterpart = target === originalEl ? translatedEl : originalEl;
                    counterpart?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const syncId = target.getAttribute('data-sync-id');
                if (syncId && originalContainer && translatedContainer) {
                    const originalEl = originalContainer.querySelector(`[data-sync-id="${syncId}"]`);
                    const translatedEl = translatedContainer.querySelector(`[data-sync-id="${syncId}"]`);
                    if (originalEl) originalEl.classList.remove('active');
                    if (translatedEl) translatedEl.classList.remove('active');
                }
            }
        };

        // Note: The dictionary click event will be added later

        const handleClick = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const sentence = target.textContent || '';
                if (!sentence.trim()) return;

                showAnalysis = true;
                analysisLoading = true;
                analysisData = null;
                analysisError = '';

                try {
                    const res = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sentence,
                            targetLanguage,
                            model: selectedModel,
                            context: book?.title + " - " + chapter?.title
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        analysisData = data;
                    } else {
                        analysisError = data.error || 'Analysis failed';
                    }
                } catch (err) {
                    analysisError = 'Failed to connect';
                } finally {
                    analysisLoading = false;
                }
            }
        };

        if (originalContainer) {
            originalContainer.addEventListener('mouseover', handleMouseOver);
            originalContainer.addEventListener('mouseout', handleMouseOut);
            originalContainer.addEventListener('click', handleClick);
        }
        if (translatedContainer) {
            translatedContainer.addEventListener('mouseover', handleMouseOver);
            translatedContainer.addEventListener('mouseout', handleMouseOut);
            translatedContainer.addEventListener('click', handleClick);
        }

        return () => {
            if (originalContainer) {
                originalContainer.removeEventListener('mouseover', handleMouseOver);
                originalContainer.removeEventListener('mouseout', handleMouseOut);
                originalContainer.removeEventListener('click', handleClick);
            }
            if (translatedContainer) {
                translatedContainer.removeEventListener('mouseover', handleMouseOver);
                translatedContainer.removeEventListener('mouseout', handleMouseOut);
                translatedContainer.removeEventListener('click', handleClick);
            }
        };
    }, 100);
  }

</script>

<div class="h-screen flex flex-col bg-[#fcfaf7]">
  <header class="flex-none bg-white border-b border-[#e5e5e5] px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
    <div class="flex items-center gap-4">
      <button
        onclick={() => dispatch('close')}
        class="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
        title="Back to Library"
      >
        <ArrowLeft class="w-5 h-5" />
      </button>
      <div class="h-6 w-px bg-gray-200"></div>
      <div class="flex items-center gap-3">
        {#if book?.coverUrl}
            <img src={book.coverUrl} alt="Cover" class="w-8 h-10 object-cover rounded shadow-sm" />
        {:else}
            <div class="w-8 h-10 bg-gray-100 flex items-center justify-center rounded shadow-sm">
              <BookOpen class="w-4 h-4 text-gray-400" />
            </div>
        {/if}
        <div>
            <h1 class="font-semibold text-gray-900 leading-tight">{book?.title}</h1>
            <p class="text-xs text-gray-500">{chapter?.title || 'Chapter'}</p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-4 relative">
      <div class="relative">
        <button
          onclick={() => showModelSettings = !showModelSettings}
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Settings class="w-4 h-4" />
          {models.find(m => m.id === selectedModel)?.name || 'Select Model'}
        </button>

        {#if showModelSettings}
          <div class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            <div class="px-4 py-2 border-b border-gray-100">
              <span class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Translation Model</span>
              {#each models as model}
                <label class="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    bind:group={selectedModel}
                    class="text-blue-600 focus:ring-blue-500"
                  />
                  <span class="text-sm text-gray-700">{model.name}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <div class="flex-1 flex overflow-hidden">
    <!-- Original Pane -->
    <div class="w-1/2 overflow-y-auto relative p-8">
      {#if loading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
        </div>
      {:else if error}
        <div class="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>
      {:else}
        <div bind:this={originalContainer} class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto">
          {@html htmlContent}
        </div>
      {/if}
    </div>

    <!-- Divider -->
    <div class="w-px bg-gray-200 flex-none"></div>

    <!-- Translated Pane -->
    <div class="w-1/2 overflow-y-auto relative p-8 bg-white/50 flex flex-col">
      {#if translationLoading && totalTranslationParts > 0}
        <div class="w-full h-1 bg-gray-100 mb-4 sticky top-0 z-10 rounded-full overflow-hidden flex-none">
          <div class="h-full bg-blue-500 transition-all duration-300" style={`width: ${(completedTranslationParts / totalTranslationParts) * 100}%`}></div>
        </div>
      {/if}

      {#if translationError}
        <div class="text-red-500 p-4 bg-red-50 rounded-lg mb-4 flex-none">{translationError}</div>
      {/if}

      {#if translatedContent}
        <div bind:this={translatedContainer} class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto w-full" dir="rtl">
          {@html translatedContent}
        </div>
      {/if}

      {#if translationLoading && completedTranslationParts < totalTranslationParts}
        <div class="mt-6 space-y-6 mx-auto w-full max-w-[65ch]">
          {#each Array(Math.min(3, totalTranslationParts - completedTranslationParts)) as _}
            <div class="animate-pulse space-y-3">
              <div class="h-4 bg-gray-200 rounded w-full"></div>
              <div class="h-4 bg-gray-200 rounded w-11/12"></div>
              <div class="h-4 bg-gray-200 rounded w-9/12"></div>
            </div>
          {/each}
          <div class="text-center pt-4">
             <span class="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></span>
             <p class="text-xs text-gray-400 mt-2">{translateProgressText}</p>
          </div>
        </div>
      {:else if !translatedContent && !translationLoading && !loading && htmlContent && !translationError}
        <div class="flex flex-col justify-center items-center h-64 gap-4 text-gray-400">
           <p>Waiting for translation...</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Analysis Panel -->
  {#if showAnalysis}
    <div class="fixed top-20 right-8 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col max-h-[80vh] overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 class="font-semibold text-gray-800">Sentence Analysis</h3>
            <button onclick={() => showAnalysis = false} class="text-gray-400 hover:text-gray-600">
                <X class="w-5 h-5" />
            </button>
        </div>
        <div class="p-5 overflow-y-auto flex-1">
            {#if analysisLoading}
                <div class="flex flex-col items-center justify-center py-10 gap-3">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span class="text-sm text-gray-500">Analyzing syntax...</span>
                </div>
            {:else if analysisError}
                <div class="text-red-500 text-sm p-3 bg-red-50 rounded-lg">{analysisError}</div>
            {:else if analysisData}
                <div class="space-y-6">
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Translation</h4>
                        <p class="text-gray-800 text-sm leading-relaxed" dir="rtl">{analysisData.translation}</p>
                    </div>

                    {#if analysisData.grammar}
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Grammar</h4>
                        <p class="text-gray-800 text-sm leading-relaxed">{analysisData.grammar}</p>
                    </div>
                    {/if}

                    {#if analysisData.words && analysisData.words.length > 0}
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vocabulary</h4>
                        <ul class="space-y-3">
                            {#each analysisData.words as item}
                            <li class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div class="flex justify-between items-start mb-1">
                                    <span class="font-semibold text-gray-900">{item.word}</span>
                                    <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{item.type}</span>
                                </div>
                                {#if item.pronunciation}
                                    <p class="text-xs text-gray-500 mb-1">/{item.pronunciation}/</p>
                                {/if}
                                <p class="text-sm text-gray-700" dir="rtl">{item.meaning}</p>
                            </li>
                            {/each}
                        </ul>
                    </div>
                    {/if}

                    {#if analysisData.nuance}
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nuance & Context</h4>
                        <p class="text-gray-800 text-sm leading-relaxed">{analysisData.nuance}</p>
                    </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
  {/if}

  <!-- Fixed Footer Navigation -->
  <footer class="flex-none bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
    <button
      onclick={() => currentChapterIndex--}
      disabled={currentChapterIndex === 0}
      class="px-5 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Previous Chapter
    </button>
    <span class="text-sm font-medium text-gray-500">Chapter {currentChapterIndex + 1} of {book?.chapters?.length}</span>
    <button
      onclick={() => currentChapterIndex++}
      disabled={currentChapterIndex === (book?.chapters?.length || 1) - 1}
      class="px-5 py-2 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Next Chapter
    </button>
  </footer>
</div>
