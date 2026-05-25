<script lang="ts">
  let {
    loading,
    error,
    originalRenderParts,
    currentPageIndex,
    container = $bindable(),
    handleMouseOver,
    handleMouseOut,
    handleClick
  }: {
    loading: boolean;
    error: string;
    originalRenderParts: string[];
    currentPageIndex: number;
    container: HTMLDivElement | null;
    handleMouseOver: (e: Event) => void;
    handleMouseOut: (e: Event) => void;
    handleClick: (e: Event) => void;
  } = $props();
  $effect(() => {
    if (currentPageIndex >= 0 && container) container.scrollTop = 0;
  });
</script>

<div class="w-1/2 overflow-y-auto relative p-8">
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
    </div>
  {:else if error}
    <div class="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>
  {:else}
    <div
      role="presentation"
      bind:this={container}
      onmouseover={handleMouseOver}
      onmouseout={handleMouseOut}
      onclick={handleClick}
      onfocus={handleMouseOver}
      onblur={handleMouseOut}
      class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto"
    >
      {#if originalRenderParts[currentPageIndex] !== undefined}
        {@html originalRenderParts[currentPageIndex]}
      {/if}
    </div>
  {/if}
</div>
