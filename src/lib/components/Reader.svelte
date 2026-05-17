<script lang="ts">
  import { ArrowLeft, BookOpen, Settings } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';

  let { book = null, globalModel = 'gemini-2.5-flash' }: { book?: any, globalModel?: string } = $props();
  
  const dispatch = createEventDispatcher();
  
  let currentChapterIndex = $state(0);
  let htmlContent = $state('');
  let loading = $state(true);
  let error = $state('');
  let showModelSettings = $state(false);
  let selectedLanguage = $state('fa');
  let targetLanguage = $state('fa');
  let readerContainer = $state<HTMLDivElement | null>(null);
  let selectedModel = $state('gemini-2.5-flash');

  let chapter = $derived(book?.chapters?.[currentChapterIndex]);

  const models = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'custom:deepseek-chat', name: 'DeepSeek V3 (Custom)' },
    { id: 'custom:deepseek-reasoner', name: 'DeepSeek R1 (Custom)' }
  ];

  async function loadChapter() {
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
  }

  $effect(() => {
    if (globalModel && !selectedModel) {
        selectedModel = globalModel;
    }
    if (chapter) loadChapter();
  });

  function attachEventListeners() {
    setTimeout(() => {
        if (!readerContainer) return;
        
        const handleMouseUp = async () => {
            const selection = window.getSelection();
            if (!selection || selection.toString().trim() === '') return;
            console.log("Selected:", selection.toString());
        };

        readerContainer.addEventListener('mouseup', handleMouseUp);
        return () => {
            if (readerContainer) {
                readerContainer.removeEventListener('mouseup', handleMouseUp);
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

  <div class="flex-1 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-8 py-12">
      {#if loading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
        </div>
      {:else if error}
        <div class="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>
      {:else}
        <div bind:this={readerContainer} class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold">
          {@html htmlContent}
        </div>
      {/if}

      <div class="mt-12 pt-8 border-t border-gray-200 flex justify-between items-center text-sm font-medium text-gray-500">
        <button
          onclick={() => currentChapterIndex--}
          disabled={currentChapterIndex === 0}
          class="px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous Chapter
        </button>
        <span>Chapter {currentChapterIndex + 1} of {book?.chapters?.length}</span>
        <button
          onclick={() => currentChapterIndex++}
          disabled={currentChapterIndex === (book?.chapters?.length || 1) - 1}
          class="px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next Chapter
        </button>
      </div>
    </div>
  </div>
</div>
