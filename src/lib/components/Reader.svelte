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
  let prefetching = $state(false);
  let prefetchedChapterIndex = $state<number | null>(null);
  let selectedSentence = $state('');
  const translationPrefetchCache = new Map<number, { originalHtml: string; translatedHtml: string }>();

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
    const cachedPrefetch = translationPrefetchCache.get(currentChapterIndex);
    if (cachedPrefetch) {
      htmlContent = cachedPrefetch.originalHtml;
      translatedContent = cachedPrefetch.translatedHtml;
      translationLoading = false;
      translationError = '';
      loading = false;
      attachEventListeners();
      prefetchNextChapter();
      return;
    }
    htmlContent = '';
    translatedContent = '';
    translationError = '';
    
    try {
      const res = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(chapter.href)}`);
      const data = await res.json();
      if (res.ok) {
          htmlContent = data.html;
          // Start translation
          translateChapter(data.html, currentChapterIndex);
      } else {
        error = data.error;
      }
    } catch (e) {
      error = 'Failed to load chapter';
    } finally {
      loading = false;
    }
  }

  async function translateChapter(sourceHtml: string, chapterIndex?: number, isPrefetch = false) {
      translationLoading = !isPrefetch;
      if (!isPrefetch) translationError = '';
      try {
          const res = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  html: sourceHtml,
                  targetLanguage,
                  model: selectedModel,
                  bookTitle: book?.title,
                  chapterTitle: chapterIndex === undefined ? chapter?.title : book?.chapters?.[chapterIndex]?.title
              })
          });
          const data = await res.json();
          if (res.ok) {
              if (chapterIndex !== undefined) {
                translationPrefetchCache.set(chapterIndex, {
                  originalHtml: data.originalHtml,
                  translatedHtml: data.translatedHtml
                });
              }
              if (!isPrefetch) {
                htmlContent = data.originalHtml; // Contains spans
                translatedContent = data.translatedHtml; // Contains spans
              }
          } else if (!isPrefetch) {
              translationError = data.error || 'Translation failed';
          }
      } catch (e) {
          if (!isPrefetch) {
            translationError = 'Failed to connect to translation service';
          }
      } finally {
          if (!isPrefetch) {
            translationLoading = false;
            attachEventListeners();
            prefetchNextChapter();
          }
      }
  }

  async function prefetchNextChapter() {
    const nextIndex = currentChapterIndex + 1;
    const nextChapter = book?.chapters?.[nextIndex];
    if (!nextChapter || prefetching || translationPrefetchCache.has(nextIndex)) return;
    prefetching = true;
    prefetchedChapterIndex = null;
    try {
      const res = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(nextChapter.href)}`);
      const data = await res.json();
      if (res.ok && data?.html) {
        await translateChapter(data.html, nextIndex, true);
        prefetchedChapterIndex = nextIndex;
      }
    } catch {
      // Best-effort UX optimization
    } finally {
      prefetching = false;
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

  function attachEventListeners() {
    setTimeout(() => {
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const syncId = target.getAttribute('data-sync-id');
                if (syncId) {
                    const elements = document.querySelectorAll(`[data-sync-id="${syncId}"]`);
                    elements.forEach(el => el.classList.add('active'));
                }
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const syncId = target.getAttribute('data-sync-id');
                if (syncId) {
                    const elements = document.querySelectorAll(`[data-sync-id="${syncId}"]`);
                    elements.forEach(el => el.classList.remove('active'));
                }
            }
        };

        // Note: The dictionary click event will be added later

        const handleClick = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('sync-hover')) {
                const sentence = target.textContent || '';
                selectedSentence = sentence;
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
      {#if prefetching}
        <span class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Preparing next chapter…</span>
      {:else if prefetchedChapterIndex === currentChapterIndex + 1}
        <span class="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">Next chapter ready</span>
      {/if}
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
    <div class="w-1/2 overflow-y-auto relative p-8 bg-white/50">
      {#if translationLoading}
        <div class="flex flex-col justify-center items-center h-64 gap-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="text-sm text-gray-500">Translating to {targetLanguage}...</p>
        </div>
      {:else if translationError}
        <div class="text-red-500 p-4 bg-red-50 rounded-lg">{translationError}</div>
      {:else if translatedContent}
        <div bind:this={translatedContainer} class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto" dir="rtl">
          {@html translatedContent}
        </div>
      {:else if !loading && htmlContent}
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
                    {#if selectedSentence}
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Selected Sentence</h4>
                        <p class="text-gray-700 text-sm leading-relaxed">{selectedSentence}</p>
                    </div>
                    {/if}
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

<style>
  :global(.sync-hover) {
    transition: background-color 120ms ease, box-shadow 120ms ease;
    border-radius: 4px;
    cursor: pointer;
  }
  :global(.sync-hover:hover) {
    background: #fef3c7;
  }
  :global(.sync-hover.active) {
    background: #fde68a;
    box-shadow: 0 0 0 1px #f59e0b inset;
  }
  :global(img.sync-hover),
  :global(table.sync-hover),
  :global(figure.sync-hover) {
    display: none !important;
  }
</style>
