<script lang="ts">
  import { ArrowLeft, BookOpen, Settings, Menu } from '@lucide/svelte';

  let {
    book,
    chapter,
    models,
    selectedModel = $bindable(),
    showModelSettings = $bindable(),
    showSidebar = $bindable(),
    onClose
  }: {
    book: any,
    chapter: any,
    models: {id: string, name: string}[],
    selectedModel: string,
    showModelSettings: boolean,
    showSidebar: boolean,
    onClose: () => void
  } = $props();
</script>

<header class="flex-none bg-white border-b border-[#e5e5e5] px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
  <div class="flex items-center gap-4">
    <button
      onclick={() => showSidebar = !showSidebar}
      class="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
      title="Table of Contents"
    >
      <Menu class="w-5 h-5" />
    </button>
    <button
      onclick={onClose}
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
