<script lang="ts">
  import { onMount } from 'svelte';
  import Library from '$lib/components/Library.svelte';
  import Reader from '$lib/components/Reader.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';

  let book: any = $state(null);
  let loading = $state(true);
  let globalModel = $state('gemini-2.5-flash');
  let showSettings = $state(false);

  onMount(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.defaultModel) {
            globalModel = data.defaultModel;
        }
      }
    } catch (e) {
      console.error("Failed to load settings on mount", e);
    } finally {
      loading = false;
    }
  });

  function handleSettingsClose() {
    showSettings = false;
    // Re-fetch default model in case it changed
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.defaultModel) {
            globalModel = data.defaultModel;
        }
      })
      .catch(console.error);
  }

</script>

{#if loading}
  <div class="flex h-screen items-center justify-center bg-[#fcfaf7]">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
  </div>
{:else if !book}
  <Library 
    {globalModel} 
    on:openBook={(e) => book = e.detail} 
    on:openSettings={() => showSettings = true}
  />
{:else}
  <Reader 
    {book} 
    {globalModel} 
    on:close={() => book = null} 
  />
{/if}

<SettingsModal 
  show={showSettings} 
  on:close={handleSettingsClose}
/>
