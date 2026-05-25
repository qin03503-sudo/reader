<script lang="ts">
  let { settings = $bindable() }: { settings: any } = $props();

  const modelOptions = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
    { id: 'custom', name: 'Custom OpenAI' },
    { id: 'litellm', name: 'LiteLLM' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'mistral', name: 'Mistral AI' }
  ];
</script>

<div class="space-y-4">
  <div class="flex justify-between items-start mb-6">
    <div>
      <h3 class="font-semibold text-lg text-gray-900 mb-1">General Settings</h3>
      <p class="text-sm text-gray-500">Configure global application behavior.</p>
    </div>
  </div>

  <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-5">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1.5" for="defaultModel">
        Default Translation Model
      </label>
      <p class="text-xs text-gray-500 mb-3">This model will be selected by default when you open a book.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {#each modelOptions as model}
          <label class="relative flex items-center p-4 border rounded-[10px] cursor-pointer transition-colors hover:bg-gray-50 {settings.defaultModel === model.id ? 'border-[#2563eb] bg-blue-50/50' : 'border-gray-200'}">
            <div class="flex items-center h-5">
              <input
                type="radio"
                name="defaultModel"
                value={model.id}
                bind:group={settings.defaultModel}
                class="w-4 h-4 text-[#2563eb] border-gray-300 focus:ring-[#2563eb]"
              />
            </div>
            <div class="ml-3">
              <span class="block text-sm font-medium {settings.defaultModel === model.id ? 'text-[#2563eb]' : 'text-gray-900'}">
                {model.name}
              </span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <div class="pt-4 border-t border-gray-100">
      <h4 class="text-sm font-medium text-gray-900 mb-4">Translation Performance</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5" for="concurrencyLimit">
            Concurrency Limit
          </label>
          <input
            id="concurrencyLimit"
            type="number"
            min="1"
            max="20"
            bind:value={settings.concurrencyLimit}
            class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
          />
          <p class="text-xs text-gray-500 mt-1.5">Number of parallel requests.</p>
        </div>
      </div>
    </div>

    <div class="pt-4 border-t border-gray-100">
      <h4 class="text-sm font-medium text-gray-900 mb-4">Retry Logic</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5" for="maxRetries">
            Max Retries
          </label>
          <input
            id="maxRetries"
            type="number"
            min="0"
            max="10"
            bind:value={settings.maxRetries}
            class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5" for="baseDelay">
            Base Delay (ms)
          </label>
          <input
            id="baseDelay"
            type="number"
            min="100"
            step="100"
            bind:value={settings.baseDelay}
            class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5" for="maxDelay">
            Max Delay (ms)
          </label>
          <input
            id="maxDelay"
            type="number"
            min="1000"
            step="1000"
            bind:value={settings.maxDelay}
            class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
          />
        </div>
      </div>
    </div>
  </div>
</div>
