<script lang="ts">
  import { X } from '@lucide/svelte';

  let { settings = $bindable() }: { settings: any } = $props();

  function addGeminiKey() {
    settings.geminiKeys = [...settings.geminiKeys, ''];
  }

  function removeGeminiKey(index: number) {
    settings.geminiKeys = settings.geminiKeys.filter((_: any, i: number) => i !== index);
  }

  function handleGeminiKeyChange(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    settings.geminiKeys[index] = target.value;
  }
</script>

<div class="space-y-4">
  <div class="flex justify-between items-start mb-6">
    <div>
      <h3 class="font-semibold text-lg text-gray-900 mb-1">Google Gemini</h3>
      <p class="text-sm text-gray-500">Fast, reliable translations using Gemini Flash.</p>
    </div>
  </div>

  <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
    <div>
      <span class="block text-sm font-medium text-gray-700 mb-1.5">
        API Keys (round-robin)
      </span>
      <p class="text-xs text-gray-500 mb-3">Add multiple keys to distribute requests and avoid rate limits.</p>
      {#each settings.geminiKeys as key, i}
        <div class="flex gap-2 mb-2">
          <input
            type="password"
            value={key}
            oninput={(e) => handleGeminiKeyChange(i, e)}
            placeholder="AIzaSy..."
            class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
          />
          <button type="button" onclick={() => removeGeminiKey(i)} class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[10px] transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>
      {/each}
      <button type="button" onclick={addGeminiKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1 inline-block">
        + Add API Key
      </button>
    </div>
  </div>
</div>
