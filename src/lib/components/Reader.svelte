<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';
  import ReaderHeader from './reader/ReaderHeader.svelte';
  import ReaderFooter from './reader/ReaderFooter.svelte';
  import AnalysisPanel from './reader/AnalysisPanel.svelte';
  import TableOfContents from './reader/TableOfContents.svelte';

  let { book = null, globalModel = 'gemini-2.5-flash' } = $props<{ book?: any, globalModel?: string }>();
  
  const dispatch = createEventDispatcher();
  
  let currentChapterIndex = $state(0);
  let originalRenderParts = $state<string[]>([]);
  let translatedRenderParts = $state<string[]>([]);
  let translationLoading = $state(false);
  let loading = $state(true);
  let error = $state('');
  let translationError = $state('');
  let showModelSettings = $state(false);
  let showSidebar = $state(false);
  let selectedLanguage = $state('fa');
  let targetLanguage = $state('fa');
  let originalContainer = $state<HTMLDivElement | null>(null);
  let translatedContainer = $state<HTMLDivElement | null>(null);
  let selectedModel = $state('gemini-2.5-flash');
  let settings = $state<any>(null);
  let translateProgressText = $state('Preparing translation…');
  let totalTranslationParts = $state(0);
  let completedTranslationParts = $state(0);
  const prefetchedTranslations = new Map<number, { originalParts: string[]; translatedParts: string[] }>();

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
    originalRenderParts = [];
    translatedRenderParts = [];
    translationError = '';
    
    try {
      const res = await fetch(`/api/chapter?bookId=${book.id}&href=${encodeURIComponent(chapter.href)}`);
      const data = await res.json();
      if (res.ok) {
        originalRenderParts = splitHtmlIntoClientParts(data.html, 800);
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

  async function translateChapter(parts: string[]) {
      translationLoading = true;
      translateProgressText = 'Preparing translation…';
      translationError = '';
      completedTranslationParts = 0;
      try {
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

            // Prefix sync ids to avoid collisions across parts
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
          const translatedParts = [];
          const originalParts = [];

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


  const getSyncPair = (syncId: string): HTMLElement[] => {
    if (!syncId) return [];
    const selector = `[data-sync-id="${syncId}"]`;
    return [
      ...(originalContainer?.querySelectorAll<HTMLElement>(selector) || []),
      ...(translatedContainer?.querySelectorAll<HTMLElement>(selector) || [])
    ];
  };

  const getTargetElement = (e: Event): HTMLElement | null => {
    const el = (e.target as HTMLElement | null)?.closest('.sync-hover') as HTMLElement | null;
    if (!el || (!originalContainer?.contains(el) && !translatedContainer?.contains(el))) return null;
    return el;
  };

  const handleMouseOver = (e: Event) => {
    const el = getTargetElement(e);
    if (!el) return;
    const syncId = el.getAttribute('data-sync-id');
    if (syncId) getSyncPair(syncId).forEach(el => el.classList.add('active'));
  };

  const handleMouseOut = (e: Event) => {
    const el = getTargetElement(e);
    if (!el) return;
    const syncId = el.getAttribute('data-sync-id');
    if (syncId) getSyncPair(syncId).forEach(el => el.classList.remove('active'));
  };

  const handleClick = async (e: Event) => {
    const el = getTargetElement(e);
    if (!el) return;

    const syncId = el.getAttribute('data-sync-id');
    if (!syncId) return;

    const counterpart = getSyncPair(syncId).find(element => element !== el);
    if (counterpart) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      counterpart.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion ? 'instant' : 'smooth'
      });
    }

    const sentence = el.textContent || '';
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
  };


</script>

<div class="h-screen flex flex-col bg-[#fcfaf7]">
  <ReaderHeader
    {book}
    {chapter}
    {models}
    bind:selectedModel
    bind:showModelSettings
    bind:showSidebar
    onClose={() => dispatch('close')}
  />

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
        <div role="presentation" bind:this={originalContainer} onmouseover={handleMouseOver} onmouseout={handleMouseOut} onclick={handleClick} onfocus={handleMouseOver} onblur={handleMouseOut} class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto">
          {#each originalRenderParts as part}
            {@html part}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Divider -->
    <div class="w-px bg-gray-200 flex-none"></div>

    <!-- Translated Pane -->
    <div class="w-1/2 overflow-y-auto relative p-8 bg-white/50">
      {#if translatedRenderParts.length > 0}
        <div role="presentation" bind:this={translatedContainer} onmouseover={handleMouseOver} onmouseout={handleMouseOut} onclick={handleClick} onfocus={handleMouseOver} onblur={handleMouseOut} class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto" dir="rtl">
          {#each translatedRenderParts as part}
            {@html part}
          {/each}
        </div>
        {#if translationLoading && completedTranslationParts < totalTranslationParts}
          <div class="mt-6 space-y-3">
            {#each Array.from({ length: Math.max(0, Math.min(3, totalTranslationParts - completedTranslationParts)) }) as _}
              <div class="animate-pulse space-y-2">
                <div class="h-3 bg-gray-200 rounded w-full"></div>
                <div class="h-3 bg-gray-200 rounded w-11/12"></div>
                <div class="h-3 bg-gray-200 rounded w-9/12"></div>
              </div>
            {/each}
          </div>
          <div class="flex items-center gap-3 mt-4 text-sm text-gray-500">
            <div class="w-4 h-4 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <span>{translateProgressText}</span>
          </div>
        {/if}
      {:else if translationError}
        <div class="text-red-500 p-4 bg-red-50 rounded-lg">{translationError}</div>
      {:else if !loading && originalRenderParts.length > 0}
        <div class="flex flex-col justify-center items-center h-64 gap-4 text-gray-400">
           <div class="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
           <p>Preparing translation...</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Table of Contents Sidebar -->
  <TableOfContents
    bind:showSidebar
    chapters={book?.chapters || []}
    {currentChapterIndex}
    onSelect={(index) => { currentChapterIndex = index; }}
    onClose={() => showSidebar = false}
  />

  <!-- Analysis Panel -->
  <AnalysisPanel
    bind:showAnalysis
    {analysisLoading}
    {analysisError}
    {analysisData}
  />

  <!-- Fixed Footer Navigation -->
  <ReaderFooter
    bind:currentChapterIndex
    totalChapters={book?.chapters?.length || 1}
  />
</div>
