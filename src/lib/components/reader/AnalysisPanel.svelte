<script lang="ts">
  import { X } from '@lucide/svelte';

  let {
    showAnalysis = $bindable(),
    analysisLoading,
    analysisError,
    analysisData
  }: {
    showAnalysis: boolean,
    analysisLoading: boolean,
    analysisError: string,
    analysisData: any
  } = $props();
</script>

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
