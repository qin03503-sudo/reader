<script lang="ts">
  import Library from '$lib/components/Library.svelte';
  import Reader from '$lib/components/Reader.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { showToast } from '$lib/stores/toast';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let book: any = $state(null);
  let showSettings = $state(false);

  let globalModel = $derived(data.defaultModel);

  async function handleSettingsClose() {
    showSettings = false;
    await invalidateAll();
  }
</script>

{#if !book}
  <Library 
    {globalModel} 
    books={data.books}
    on:openBook={(e) => book = e.detail} 
    on:openSettings={() => showSettings = true}
  />
{:else}
  <Reader 
    {book} 
    {globalModel} 
    settings={data.settings}
    on:close={() => book = null} 
  />
{/if}

{#if showSettings}
  <SettingsModal
    show={true}
    initialSettings={data.settings}
    on:close={handleSettingsClose}
  />
{/if}

<Toast />
