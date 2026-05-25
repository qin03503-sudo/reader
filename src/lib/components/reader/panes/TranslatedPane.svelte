<script lang="ts">
  let {
    loading,
    translationLoading,
    translationError,
    originalRenderParts,
    translatedRenderParts,
    totalTranslationParts,
    completedTranslationParts,
    translateProgressText,
    container = $bindable(),
    handleMouseOver,
    handleMouseOut,
    handleClick
  }: {
    loading: boolean;
    translationLoading: boolean;
    translationError: string;
    originalRenderParts: string[];
    translatedRenderParts: string[];
    totalTranslationParts: number;
    completedTranslationParts: number;
    translateProgressText: string;
    container: HTMLDivElement | null;
    handleMouseOver: (e: Event) => void;
    handleMouseOut: (e: Event) => void;
    handleClick: (e: Event) => void;
  } = $props();
</script>

<div class="w-1/2 overflow-y-auto relative p-8 bg-white/50">
  {#if translatedRenderParts.length > 0}
    <div
      role="presentation"
      bind:this={container}
      onmouseover={handleMouseOver}
      onmouseout={handleMouseOut}
      onclick={handleClick}
      onfocus={handleMouseOver}
      onblur={handleMouseOut}
      class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto"
      dir="rtl"
    >
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
