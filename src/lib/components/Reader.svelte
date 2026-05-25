<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';
  import ReaderHeader from './reader/ReaderHeader.svelte';
  import ReaderFooter from './reader/ReaderFooter.svelte';
  import AnalysisPanel from './reader/AnalysisPanel.svelte';
  import OriginalPane from './reader/panes/OriginalPane.svelte';
  import TranslatedPane from './reader/panes/TranslatedPane.svelte';
  import { createReaderState } from '$lib/states/reader.svelte';
  import { createSyncState } from '$lib/states/sync.svelte';

  let { book = null, globalModel = 'gemini-2.5-flash', settings = null } = $props<{ book?: any, globalModel?: string, settings?: any }>();
  
  const dispatch = createEventDispatcher();
  
  const readerState = createReaderState();
  const syncState = createSyncState();

  let showModelSettings = $state(false);

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

  onMount(() => {
    readerState.book = book;
    readerState.globalModel = globalModel;
    readerState.selectedModel = globalModel || 'gemini-2.5-flash';
  });

  $effect(() => {
    // When book prop changes, update state
    readerState.book = book;
  });

  $effect(() => {
    // Trigger load chapter when chapter changes
    if (readerState.chapter) {
      readerState.loadChapter();
    }
  });

  function handleInteractionClick(e: Event) {
    syncState.handleClick(e, {
      targetLanguage: readerState.targetLanguage,
      selectedModel: readerState.selectedModel,
      bookTitle: book?.title,
      chapterTitle: readerState.chapter?.title
    });
  }
</script>

<div class="h-screen flex flex-col bg-[#fcfaf7]">
  <ReaderHeader
    {book}
    chapter={readerState.chapter}
    {models}
    bind:selectedModel={readerState.selectedModel}
    bind:showModelSettings
    bind:currentChapterIndex={readerState.currentChapterIndex}
    onClose={() => dispatch('close')}
  />

  <div class="flex-1 flex overflow-hidden">
    <!-- Original Pane -->
    <OriginalPane
      loading={readerState.loading}
      error={readerState.error}
      originalRenderParts={readerState.originalRenderParts}
      currentPageIndex={readerState.currentPageIndex}
      bind:container={syncState.originalContainer}
      handleMouseOver={syncState.handleMouseOver}
      handleMouseOut={syncState.handleMouseOut}
      handleClick={handleInteractionClick}
    />

    <!-- Divider -->
    <div class="w-px bg-gray-200 flex-none"></div>

    <!-- Translated Pane -->
    <TranslatedPane
      loading={readerState.loading}
      translationLoading={readerState.translationLoading}
      translationError={readerState.translationError}
      originalRenderParts={readerState.originalRenderParts}
      translatedRenderParts={readerState.translatedRenderParts}
      currentPageIndex={readerState.currentPageIndex}
      totalTranslationParts={readerState.totalTranslationParts}
      completedTranslationParts={readerState.completedTranslationParts}
      translateProgressText={readerState.translateProgressText}
      bind:container={syncState.translatedContainer}
      handleMouseOver={syncState.handleMouseOver}
      handleMouseOut={syncState.handleMouseOut}
      handleClick={handleInteractionClick}
    />
  </div>

  <!-- Analysis Panel -->
  <AnalysisPanel
    bind:showAnalysis={syncState.showAnalysis}
    analysisLoading={syncState.analysisLoading}
    analysisError={syncState.analysisError}
    analysisData={syncState.analysisData}
  />

  <!-- Fixed Footer Navigation -->
  <ReaderFooter
    bind:currentChapterIndex={readerState.currentChapterIndex}
    totalChapters={book?.chapters?.length || 1}
    currentPageIndex={readerState.currentPageIndex}
    totalPages={readerState.totalPages}
    nextPage={readerState.nextPage}
    previousPage={readerState.previousPage}
  />
</div>
