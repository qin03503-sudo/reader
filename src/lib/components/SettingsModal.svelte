<script lang="ts">
  import { X } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let { show = false }: { show?: boolean } = $props();

  let settings = $state({
    openaiKey: '',
    openaiBaseUrl: '',
    openaiKeys: [] as string[]
  });
  let saving = $state(false);

  onMount(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) {
        settings = { ...settings, ...data };
      }
    } catch(e) {}
  });

  async function handleSave() {
    saving = true;
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      dispatch('close');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      saving = false;
    }
  }

  function handleKeyChange(index: number, e: Event) {
      const val = (e.target as HTMLInputElement).value;
      settings.openaiKeys[index] = val;
  }
  function addKey() {
      settings.openaiKeys = [...settings.openaiKeys, ''];
  }
  function removeKey(index: number) {
      settings.openaiKeys = settings.openaiKeys.filter((_, i) => i !== index);
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
      <button 
        onclick={() => dispatch('close')}
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-900"
      >
        <X class="w-5 h-5" />
      </button>
      
      <h2 class="text-xl font-semibold mb-6">Settings</h2>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="baseUrl">
            OpenAI API Base URL
          </label>
          <input 
            id="baseUrl"
            type="text" 
            bind:value={settings.openaiBaseUrl}
            placeholder="e.g. https://api.openai.com/v1"
            class="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
            <span class="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Keys (round-robin)
            </span>
            {#each settings.openaiKeys as key, i}
                <div class="flex gap-2 mb-2">
                    <input 
                        type="password" 
                        value={key}
                        oninput={(e) => handleKeyChange(i, e)}
                        placeholder="sk-..."
                        class="flex-1 border border-gray-300 rounded-md p-2 text-sm"
                    />
                    <button type="button" onclick={() => removeKey(i)} class="p-2 text-red-500">
                        <X class="w-4 h-4" />
                    </button>
                </div>
            {/each}
            <button type="button" onclick={addKey} class="text-blue-500 text-sm mt-1">
                + Add another key
            </button>
        </div>

        <div class="pt-4 flex justify-end gap-3">
          <button 
            onclick={() => dispatch('close')}
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button 
            onclick={handleSave}
            disabled={saving}
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
