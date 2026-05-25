<script lang="ts">
  import { X } from '@lucide/svelte';

  let {
    showSidebar = $bindable(),
    chapters = [],
    currentChapterIndex,
    onSelect,
    onClose
  }: {
    showSidebar: boolean,
    chapters: any[],
    currentChapterIndex: number,
    onSelect: (index: number) => void,
    onClose: () => void
  } = $props();
</script>

{#if showSidebar}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/20 z-20 transition-opacity"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="0"
    aria-label="Close sidebar"
  ></div>

  <!-- Sidebar -->
  <div class="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-30 flex flex-col transform transition-transform duration-300 ease-in-out">
    <div class="flex-none flex items-center justify-between p-4 border-b border-gray-100">
      <h2 class="text-lg font-semibold text-gray-900">Table of Contents</h2>
      <button
        onclick={onClose}
        class="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        title="Close Sidebar"
      >
        <X class="w-5 h-5" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-1">
      {#each chapters as chapter, i}
        <button
          onclick={() => { onSelect(i); onClose(); }}
          class="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors {i === currentChapterIndex ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}"
        >
          <span class="line-clamp-2">{chapter.title || `Chapter ${i + 1}`}</span>
        </button>
      {/each}

      {#if chapters.length === 0}
         <div class="text-sm text-gray-500 text-center py-8">No chapters available</div>
      {/if}
    </div>
  </div>
{/if}
