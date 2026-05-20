<script lang="ts">
  import { X, CheckCircle2, AlertCircle, Play } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let { show = false }: { show?: boolean } = $props();

  let settings = $state({
    openaiKey: '',
    openaiBaseUrl: '',
    openaiKeys: [] as string[],
    openaiModel: 'deepseek-chat',
    litellmBaseUrl: '',
    litellmKeys: [] as string[],
    litellmModel: 'deepseek-chat',
    openrouterKey: '',
    openrouterModel: 'deepseek/deepseek-chat',
    defaultModel: 'gemini-2.5-flash'
  });

  let saving = $state(false);

  // Test states
  let testingStatus = $state<Record<string, { loading: boolean, success?: boolean, error?: string }>>({
      custom: { loading: false },
      litellm: { loading: false },
      openrouter: { loading: false }
  });

  const modelOptions = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
    { id: 'custom', name: 'Custom OpenAI' },
    { id: 'litellm', name: 'LiteLLM' },
    { id: 'openrouter', name: 'OpenRouter' }
  ];

  onMount(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) {
        settings = { ...settings, ...data };
      }
      if (!settings.openaiKeys) settings.openaiKeys = [];
      if (!settings.litellmKeys) settings.litellmKeys = [];
      if (!settings.litellmBaseUrl) settings.litellmBaseUrl = '';
      if (!settings.openrouterKey) settings.openrouterKey = '';
      if (!settings.openaiBaseUrl) settings.openaiBaseUrl = '';
      if (!settings.openaiModel) settings.openaiModel = 'deepseek-chat';
      if (!settings.litellmModel) settings.litellmModel = 'deepseek-chat';
      if (!settings.openrouterModel) settings.openrouterModel = 'deepseek/deepseek-chat';
      if (!settings.defaultModel) settings.defaultModel = 'gemini-2.5-flash';
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

  async function testConnection(provider: string) {
      testingStatus[provider] = { loading: true };

      let config = {};
      if (provider === 'custom') {
          config = {
              baseUrl: settings.openaiBaseUrl,
              key: settings.openaiKeys[0] || '',
              model: settings.openaiModel
          };
      } else if (provider === 'litellm') {
          config = {
              baseUrl: settings.litellmBaseUrl,
              key: settings.litellmKeys[0] || '',
              model: settings.litellmModel
          };
      } else if (provider === 'openrouter') {
          config = {
              key: settings.openrouterKey,
              model: settings.openrouterModel
          };
      }

      try {
          const res = await fetch('/api/test-translation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ provider, config })
          });

          const data = await res.json();
          if (data.success) {
              testingStatus[provider] = { loading: false, success: true };
          } else {
              testingStatus[provider] = { loading: false, success: false, error: data.error };
          }
      } catch (err: any) {
          testingStatus[provider] = { loading: false, success: false, error: err.message };
      }

      setTimeout(() => {
          if (testingStatus[provider]) {
             testingStatus[provider].success = undefined;
             testingStatus[provider].error = undefined;
          }
      }, 3000);
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

  function handleLitellmKeyChange(index: number, e: Event) {
      const val = (e.target as HTMLInputElement).value;
      settings.litellmKeys[index] = val;
  }
  function addLitellmKey() {
      settings.litellmKeys = [...settings.litellmKeys, ''];
  }
  function removeLitellmKey(index: number) {
      settings.litellmKeys = settings.litellmKeys.filter((_, i) => i !== index);
  }

</script>

{#if show}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 font-sans text-[#1a1a1a]">
    <div class="bg-[#fcfaf7] rounded-[10px] shadow-2xl max-w-xl w-full p-8 relative border border-[#e5e5e5]">
      <button 
        onclick={() => dispatch('close')}
        class="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"
      >
        <X class="w-6 h-6" />
      </button>
      
      <h2 class="text-2xl font-bold mb-8 tracking-tight">Translation Settings</h2>
      
      <div class="space-y-8 max-h-[65vh] overflow-y-auto pr-4 scrollbar-thin">
        
        <!-- Global Default Provider -->
        <div class="space-y-3 bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm">
          <h3 class="font-semibold text-lg text-gray-900">Default Model</h3>
          <p class="text-sm text-gray-500 mb-2">Select the default model to use for translating new books.</p>
          <select
            bind:value={settings.defaultModel}
            class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
          >
            {#each modelOptions as opt}
              <option value={opt.id}>{opt.name}</option>
            {/each}
          </select>
        </div>

        <!-- Custom OpenAI -->
        <div class="space-y-4 bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm">
          <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold text-lg text-gray-900">Custom OpenAI</h3>
              <button
                onclick={() => testConnection('custom')}
                disabled={testingStatus.custom.loading}
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#2563eb] bg-blue-50 hover:bg-blue-100 rounded-[10px] transition-colors disabled:opacity-50"
              >
                  {#if testingStatus.custom.loading}
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2563eb]"></div>
                      <span>Testing...</span>
                  {:else if testingStatus.custom.success}
                      <CheckCircle2 class="w-4 h-4 text-green-500" />
                      <span class="text-green-600">Success</span>
                  {:else if testingStatus.custom.error}
                      <AlertCircle class="w-4 h-4 text-red-500" />
                      <span class="text-red-600">Failed</span>
                  {:else}
                      <Play class="w-4 h-4" />
                      <span>Test</span>
                  {/if}
              </button>
          </div>

          {#if testingStatus.custom.error}
              <div class="text-xs text-red-500 bg-red-50 p-2 rounded-[10px]">{testingStatus.custom.error}</div>
          {/if}

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="baseUrl">
              Base URL
            </label>
            <input
              id="baseUrl"
              type="text"
              bind:value={settings.openaiBaseUrl}
              placeholder="e.g. https://api.openai.com/v1"
              class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="openaiModel">
              Model Name
            </label>
            <input
              id="openaiModel"
              type="text"
              bind:value={settings.openaiModel}
              placeholder="e.g. deepseek-chat"
              class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
            />
          </div>

          <div>
              <span class="block text-sm font-medium text-gray-700 mb-1.5">
                API Keys (round-robin)
              </span>
              {#each settings.openaiKeys as key, i}
                  <div class="flex gap-2 mb-2">
                      <input
                          type="password"
                          value={key}
                          oninput={(e) => handleKeyChange(i, e)}
                          placeholder="sk-..."
                          class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                      />
                      <button type="button" onclick={() => removeKey(i)} class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[10px] transition-colors">
                          <X class="w-4 h-4" />
                      </button>
                  </div>
              {/each}
              <button type="button" onclick={addKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1">
                  + Add another key
              </button>
          </div>
        </div>

        <!-- LiteLLM -->
        <div class="space-y-4 bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm">
           <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold text-lg text-gray-900">LiteLLM Proxy</h3>
              <button
                onclick={() => testConnection('litellm')}
                disabled={testingStatus.litellm.loading}
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#2563eb] bg-blue-50 hover:bg-blue-100 rounded-[10px] transition-colors disabled:opacity-50"
              >
                  {#if testingStatus.litellm.loading}
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2563eb]"></div>
                      <span>Testing...</span>
                  {:else if testingStatus.litellm.success}
                      <CheckCircle2 class="w-4 h-4 text-green-500" />
                      <span class="text-green-600">Success</span>
                  {:else if testingStatus.litellm.error}
                      <AlertCircle class="w-4 h-4 text-red-500" />
                      <span class="text-red-600">Failed</span>
                  {:else}
                      <Play class="w-4 h-4" />
                      <span>Test</span>
                  {/if}
              </button>
          </div>

          {#if testingStatus.litellm.error}
              <div class="text-xs text-red-500 bg-red-50 p-2 rounded-[10px]">{testingStatus.litellm.error}</div>
          {/if}

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="litellmBaseUrl">
              Base URL
            </label>
            <input
              id="litellmBaseUrl"
              type="text"
              bind:value={settings.litellmBaseUrl}
              placeholder="e.g. https://your-litellm-proxy.com"
              class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="litellmModel">
              Model Name
            </label>
            <input
              id="litellmModel"
              type="text"
              bind:value={settings.litellmModel}
              placeholder="e.g. deepseek-chat"
              class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
            />
          </div>

          <div>
              <span class="block text-sm font-medium text-gray-700 mb-1.5">
                API Keys (round-robin)
              </span>
              {#each settings.litellmKeys as key, i}
                  <div class="flex gap-2 mb-2">
                      <input
                          type="password"
                          value={key}
                          oninput={(e) => handleLitellmKeyChange(i, e)}
                          placeholder="sk-..."
                          class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                      />
                      <button type="button" onclick={() => removeLitellmKey(i)} class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[10px] transition-colors">
                          <X class="w-4 h-4" />
                      </button>
                  </div>
              {/each}
              <button type="button" onclick={addLitellmKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1">
                  + Add another key
              </button>
          </div>
        </div>

        <!-- OpenRouter -->
        <div class="space-y-4 bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm">
           <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold text-lg text-gray-900">OpenRouter</h3>
              <button
                onclick={() => testConnection('openrouter')}
                disabled={testingStatus.openrouter.loading}
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#2563eb] bg-blue-50 hover:bg-blue-100 rounded-[10px] transition-colors disabled:opacity-50"
              >
                  {#if testingStatus.openrouter.loading}
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2563eb]"></div>
                      <span>Testing...</span>
                  {:else if testingStatus.openrouter.success}
                      <CheckCircle2 class="w-4 h-4 text-green-500" />
                      <span class="text-green-600">Success</span>
                  {:else if testingStatus.openrouter.error}
                      <AlertCircle class="w-4 h-4 text-red-500" />
                      <span class="text-red-600">Failed</span>
                  {:else}
                      <Play class="w-4 h-4" />
                      <span>Test</span>
                  {/if}
              </button>
          </div>

          {#if testingStatus.openrouter.error}
              <div class="text-xs text-red-500 bg-red-50 p-2 rounded-[10px]">{testingStatus.openrouter.error}</div>
          {/if}

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="openrouterModel">
              Model Name
            </label>
            <input
              id="openrouterModel"
              type="text"
              bind:value={settings.openrouterModel}
              placeholder="e.g. deepseek/deepseek-chat"
              class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="openrouterKey">
              API Key
            </label>
            <input
              id="openrouterKey"
              type="password"
              bind:value={settings.openrouterKey}
              placeholder="sk-or-v1-..."
              class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
            />
          </div>
        </div>

      </div>

      <div class="pt-8 mt-4 border-t border-[#e5e5e5] flex justify-end gap-3">
        <button
          onclick={() => dispatch('close')}
          class="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-[10px] transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={handleSave}
          disabled={saving}
          class="px-5 py-2.5 text-sm font-medium bg-[#2563eb] text-white rounded-[10px] hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>
{/if}
