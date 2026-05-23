import re

with open('src/lib/components/Reader.svelte', 'r') as f:
    content = f.read()

# Update script section
script_replacement = """  let currentChapterIndex = $state(0);
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
  let settings = $state<any>(null);"""
content = re.sub(r"  let currentChapterIndex = \$state\(0\);.*?let settings = \$state<any>\(null\);", script_replacement, content, flags=re.DOTALL)

# Update body layout
body_old = """  <div class="flex-1 overflow-y-auto">
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
  </div>"""

body_new = """  <div class="flex-1 flex overflow-hidden">
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
  </footer>"""

content = content.replace(body_old, body_new)

# Update readerContainer reference in event listeners temporarily (we'll fix full logic later)
content = content.replace("if (!readerContainer) return;", "if (!originalContainer) return;")
content = content.replace("readerContainer.addEventListener", "originalContainer.addEventListener")
content = content.replace("readerContainer.removeEventListener", "originalContainer.removeEventListener")

with open('src/lib/components/Reader.svelte', 'w') as f:
    f.write(content)
