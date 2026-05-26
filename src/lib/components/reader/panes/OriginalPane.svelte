<script lang="ts">
  import ScrollablePane from './ScrollablePane.svelte';
  import PaneContent from './PaneContent.svelte';

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
</script>

<ScrollablePane {currentPageIndex}>
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
    </div>
  {:else if error}
    <div class="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>
  {:else}
    <PaneContent
      htmlContent={originalRenderParts[currentPageIndex]}
      bind:container
      {handleMouseOver}
      {handleMouseOut}
      {handleClick}
    />
  {/if}
</ScrollablePane>
