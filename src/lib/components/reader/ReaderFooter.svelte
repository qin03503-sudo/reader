<script lang="ts">
  let {
    currentChapterIndex = $bindable(),
    totalChapters,
    currentPageIndex,
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

<footer class="flex-none bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
  <button
    onclick={previousPage}
    disabled={currentChapterIndex === 0 && currentPageIndex === 0}
    class="px-5 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    Previous Page
  </button>
  <span class="text-sm font-medium text-gray-500">Chapter {currentChapterIndex + 1} - Page {currentPageIndex + 1} of {totalPages || 1}</span>
  <button
    onclick={nextPage}
    disabled={currentChapterIndex === totalChapters - 1 && currentPageIndex === (totalPages || 1) - 1}
    class="px-5 py-2 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    Next Page
  </button>
</footer>
