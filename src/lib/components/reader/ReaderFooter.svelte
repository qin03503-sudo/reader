<script lang="ts">
  let {
    currentChapterIndex = $bindable(),
    totalChapters,
    currentPageIndex = $bindable(),
    totalPages,
    nextPage,
    previousPage
  }: {
    currentChapterIndex: number,
    totalChapters: number,
    currentPageIndex: number,
    totalPages: number,
    nextPage: () => void,
    previousPage: () => void
  } = $props();

</script>

<footer class="flex-none bg-white border-t border-gray-200 px-6 py-4 flex flex-col gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
  <div class="flex items-center justify-between w-full">
    <button
      onclick={previousPage}
      disabled={currentChapterIndex === 0 && currentPageIndex === 0}
      class="px-5 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
    >
      {currentChapterIndex > 0 && currentPageIndex === 0 ? "Previous Chapter" : "Previous Page"}
    </button>

    <div class="flex-1 flex flex-col items-center max-w-md mx-6 gap-1">
      <span class="text-sm font-medium text-gray-500">Chapter {currentChapterIndex + 1} - Page {currentPageIndex + 1} of {totalPages || 1}</span>
      <input
        type="range"
        min="0"
        max={Math.max(0, (totalPages || 1) - 1)}
        bind:value={currentPageIndex}
        class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        disabled={totalPages <= 1}
      />
    </div>

    <button
      onclick={nextPage}
      disabled={currentChapterIndex === totalChapters - 1 && currentPageIndex === (totalPages || 1) - 1}
      class="px-5 py-2 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
    >
      {currentChapterIndex < totalChapters - 1 && currentPageIndex === (totalPages || 1) - 1 ? "Next Chapter" : "Next Page"}
    </button>
  </div>
</footer>
