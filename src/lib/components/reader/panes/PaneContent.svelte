<script lang="ts">
  let {
    htmlContent,
    container = $bindable(),
    handleMouseOver,
    handleMouseOut,
    handleClick,
    dir = 'ltr'
  }: {
    htmlContent: string;
    container: HTMLDivElement | null;
    handleMouseOver: (e: Event) => void;
    handleMouseOut: (e: Event) => void;
    handleClick: (e: Event) => void;
    dir?: 'auto' | 'ltr' | 'rtl';
  } = $props();
</script>

<div
  role="presentation"
  bind:this={container}
  onmouseover={handleMouseOver}
  onmouseout={handleMouseOut}
  onclick={handleClick}
  onfocus={handleMouseOver}
  onblur={handleMouseOut}
  class="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold mx-auto"
  {dir}
>
  {#if htmlContent !== undefined}
    {@html htmlContent}
  {/if}
</div>
