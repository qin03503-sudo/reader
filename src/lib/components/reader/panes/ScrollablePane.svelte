<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    currentPageIndex,
    extraClasses = '',
    children
  }: {
    currentPageIndex: number;
    extraClasses?: string;
    children: Snippet;
  } = $props();

  let scrollContainer: HTMLDivElement;

  $effect(() => {
    // Reset scroll on page change
    if (currentPageIndex >= 0 && scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  });
</script>

<div
  bind:this={scrollContainer}
  class="w-1/2 overflow-y-auto relative p-8 {extraClasses}"
>
  {@render children()}
</div>
