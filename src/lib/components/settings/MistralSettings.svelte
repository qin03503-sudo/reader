<script lang="ts">
  import { X, CheckCircle2, AlertCircle, Play } from '@lucide/svelte';

  let {
    settings = $bindable(),
    testingStatus,
    onTestConnection
  }: {
    settings: any,
    testingStatus: { loading: boolean, success?: boolean, error?: string },
    onTestConnection: () => void
  } = $props();

  function addMistralKey() {
      settings.mistralKeys = [...settings.mistralKeys, ''];
  }
  function removeMistralKey(index: number) {
      settings.mistralKeys = settings.mistralKeys.filter((_: any, i: number) => i !== index);
  }
  function handleMistralKeyChange(index: number, event: Event) {
      const target = event.target as HTMLInputElement;
      settings.mistralKeys[index] = target.value;
  }
</script>

<div class="space-y-4">
  <div class="flex justify-between items-start mb-6">
    <div>
      <h3 class="font-semibold text-lg text-gray-900 mb-1">Mistral AI</h3>
      <p class="text-sm text-gray-500">Configure your Mistral API settings.</p>
    </div>
    <button
      onclick={onTestConnection}
      disabled={testingStatus?.loading}
      class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#2563eb] bg-blue-50 hover:bg-blue-100 rounded-[10px] transition-colors disabled:opacity-50"
    >
      {#if testingStatus?.loading}
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2563eb]"></div>
          <span>Testing...</span>
      {:else if testingStatus?.success}
          <CheckCircle2 class="w-4 h-4 text-green-500" />
          <span class="text-green-600">Success</span>
      {:else if testingStatus?.error}
          <AlertCircle class="w-4 h-4 text-red-500" />
          <span class="text-red-600">Failed</span>
      {:else}
          <Play class="w-4 h-4" />
          <span>Test Connection</span>
      {/if}
    </button>
  </div>

  {#if testingStatus?.error}
      <div class="text-xs text-red-500 bg-red-50 p-3 rounded-[10px] border border-red-100">{testingStatus.error}</div>
  {/if}

  <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
    <div>
        <span class="block text-sm font-medium text-gray-700 mb-1.5">
          API Keys (round-robin)
        </span>
        {#if settings.mistralKey && settings.mistralKeys.length === 0}
            <div class="flex gap-2 mb-2">
                <input
                    type="password"
                    bind:value={settings.mistralKey}
                    placeholder="sk-..."
                    class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                />
            </div>
        {/if}
        {#each settings.mistralKeys as key, i}
            <div class="flex gap-2 mb-2">
                <input
                    type="password"
                    value={key}
                    oninput={(e) => handleMistralKeyChange(i, e)}
                    placeholder="sk-..."
                    class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                />
                <button type="button" onclick={() => removeMistralKey(i)} class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[10px] transition-colors">
                    <X class="w-4 h-4" />
                </button>
            </div>
        {/each}
        <button type="button" onclick={addMistralKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1 inline-block">
            + Add another key
        </button>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1.5" for="mistralModel">
        Model Name
      </label>
      <input
        id="mistralModel"
        type="text"
        bind:value={settings.mistralModel}
        placeholder="e.g. mistral-large-latest"
        class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
      />
    </div>
  </div>
</div>
