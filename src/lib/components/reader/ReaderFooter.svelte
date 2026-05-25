<script lang="ts">
  let {
    currentChapterIndex = $bindable(),
    totalChapters
  }: {
    currentChapterIndex: number,
    totalChapters: number
  } = $props();

  function nextChapter() {
    if (currentChapterIndex < totalChapters - 1) {
      currentChapterIndex++;
    }
  }

  function previousChapter() {
    if (currentChapterIndex > 0) {
      currentChapterIndex--;
    }
  }
</script>

<footer class="flex-none bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
  <button
    onclick={previousChapter}
    disabled={currentChapterIndex === 0}
    class="px-5 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    Previous Chapter
  </button>
  <span class="text-sm font-medium text-gray-500">Chapter {currentChapterIndex + 1} of {totalChapters}</span>
  <button
    onclick={nextChapter}
    disabled={currentChapterIndex === totalChapters - 1}
    class="px-5 py-2 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    Next Chapter
  </button>
</footer>
