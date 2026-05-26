<script lang="ts">
  import { X, CheckCircle2, AlertCircle, Play } from '@lucide/svelte';

  let {
    title,
    description,
    hasTestConnection = true,
    hasBaseUrl = false,
    hasModelName = true,
    testingStatus = undefined,
    onTestConnection = undefined,
    baseUrl = $bindable(),
    modelName = $bindable(),
    keys = $bindable(),
    legacyKey = $bindable(),
    baseUrlPlaceholder = 'https://api.example.com/v1',
    modelPlaceholder = 'e.g. gpt-4',
    keyPlaceholder = 'sk-...'
  }: {
    title: string;
    description: string;
    hasTestConnection?: boolean;
    hasBaseUrl?: boolean;
    hasModelName?: boolean;
    testingStatus?: { loading: boolean; success?: boolean; error?: string };
    onTestConnection?: () => void;
    baseUrl?: string;
    modelName?: string;
    keys: string[];
    legacyKey?: string;
    baseUrlPlaceholder?: string;
    modelPlaceholder?: string;
    keyPlaceholder?: string;
  } = $props();

  function addKey() {
    keys = [...keys, ''];
  }
  function removeKey(index: number) {
    keys = keys.filter((_, i) => i !== index);
  }
  function handleKeyChange(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    keys[index] = target.value;
  }
</script>

<div class="space-y-4">
  <div class="flex justify-between items-start mb-6">
    <div>
      <h3 class="font-semibold text-lg text-gray-900 mb-1">{title}</h3>
      <p class="text-sm text-gray-500">{description}</p>
    </div>
    {#if hasTestConnection && onTestConnection}
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
    {/if}
  </div>

  {#if testingStatus?.error}
      <div class="text-xs text-red-500 bg-red-50 p-3 rounded-[10px] border border-red-100">{testingStatus.error}</div>
  {/if}

  <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
    {#if hasBaseUrl}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="baseUrl">
          Base URL
        </label>
        <input
          id="baseUrl"
          type="url"
          bind:value={baseUrl}
          placeholder={baseUrlPlaceholder}
          class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
        />
      </div>
    {/if}

    {#if hasModelName}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="modelName">
          Model Name
        </label>
        <input
          id="modelName"
          type="text"
          bind:value={modelName}
          placeholder={modelPlaceholder}
          class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
        />
      </div>
    {/if}

    <div>
        <span class="block text-sm font-medium text-gray-700 mb-1.5">
          API Keys (round-robin)
        </span>
        {#if !hasModelName}
            <p class="text-xs text-gray-500 mb-3">Add multiple keys to distribute requests and avoid rate limits.</p>
        {/if}
        {#if legacyKey !== undefined && legacyKey !== null && legacyKey !== '' && keys.length === 0}
            <!-- Migration for existing single key -->
            <div class="flex gap-2 mb-2">
                <input
                    type="password"
                    bind:value={legacyKey}
                    placeholder={keyPlaceholder}
                    class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                />
            </div>
        {/if}
        {#each keys as key, i}
            <div class="flex gap-2 mb-2">
                <input
                    type="password"
                    value={key}
                    oninput={(e) => handleKeyChange(i, e)}
                    placeholder={keyPlaceholder}
                    class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                />
                <button type="button" onclick={() => removeKey(i)} class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[10px] transition-colors">
                    <X class="w-4 h-4" />
                </button>
            </div>
        {/each}
        <button type="button" onclick={addKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1 inline-block">
            + {hasModelName ? 'Add another key' : 'Add API Key'}
        </button>
    </div>
  </div>
</div>
