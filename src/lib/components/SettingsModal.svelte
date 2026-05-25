<script lang="ts">
  import { X, CheckCircle2, AlertCircle, Play, Settings, Sliders, Cpu, Zap, Globe, Sparkles } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';

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
    openrouterKeys: [] as string[],
    mistralKey: '',
    mistralModel: 'mistral-large-latest',
    mistralKeys: [] as string[],
    proxyUrl: '',
    defaultModel: 'gemini-2.5-flash',
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    concurrencyLimit: 5
  });

  let saving = $state(false);
  let activeTab = $state('general');

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
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'mistral', name: 'Mistral AI' },
    { id: 'advanced', name: 'Advanced' },
        { id: 'advanced', name: 'Advanced' }
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
      if (!settings.mistralKey) settings.mistralKey = '';
      if (!settings.mistralModel) settings.mistralModel = 'mistral-large-latest';
      if (!settings.defaultModel) settings.defaultModel = 'gemini-2.5-flash';
      if (settings.maxRetries === undefined) settings.maxRetries = 3;
      if (settings.baseDelay === undefined) settings.baseDelay = 2000;
      if (settings.maxDelay === undefined) settings.maxDelay = 30000;
      if (settings.concurrencyLimit === undefined) settings.concurrencyLimit = 5;
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
      showToast('success', 'Settings saved');
      dispatch('close');
    } catch (error) {
      showToast('error', 'Failed to save settings');
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
      } else if (provider === 'mistral') {
          config = {
              key: settings.mistralKey,
              model: settings.mistralModel
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

    function handleOpenrouterKeyChange(index: number, event: Event) {
        const target = event.target as HTMLInputElement;
        settings.openrouterKeys[index] = target.value;
    }
    function addOpenrouterKey() {
        settings.openrouterKeys = [...settings.openrouterKeys, ''];
    }
    function removeOpenrouterKey(index: number) {
        settings.openrouterKeys = settings.openrouterKeys.filter((_, i) => i !== index);
    }

    function handleMistralKeyChange(index: number, event: Event) {
        const target = event.target as HTMLInputElement;
        settings.mistralKeys[index] = target.value;
    }
    function addMistralKey() {
        settings.mistralKeys = [...settings.mistralKeys, ''];
    }
    function removeMistralKey(index: number) {
        settings.mistralKeys = settings.mistralKeys.filter((_, i) => i !== index);
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
    <div class="bg-[#fcfaf7] rounded-[10px] shadow-2xl max-w-4xl w-full relative border border-[#e5e5e5] overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-white shrink-0">
        <h2 class="text-xl font-bold tracking-tight">Translation Settings</h2>
        <button
          onclick={() => dispatch('close')}
          class="text-gray-400 hover:text-gray-900 transition-colors rounded-[10px] p-1 hover:bg-gray-100"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex flex-1 overflow-hidden min-h-0">
        <!-- Sidebar Navigation -->
        <div class="w-64 bg-gray-50/50 border-r border-[#e5e5e5] flex flex-col p-4 space-y-1 overflow-y-auto shrink-0">
          <button
            onclick={() => activeTab = 'general'}
            class="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === 'general' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900'}"
          >
            <Settings class="w-4 h-4" />
            General
          </button>

          <button
            onclick={() => activeTab = 'advanced'}
            class="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === 'advanced' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900'}"
          >
            <Sliders class="w-4 h-4" />
            Advanced
          </button>

          <div class="pt-4 pb-2 px-3">
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Providers</span>
          </div>

          <button
            onclick={() => activeTab = 'custom'}
            class="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === 'custom' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900'}"
          >
            <Cpu class="w-4 h-4" />
            Custom OpenAI
          </button>

          <button
            onclick={() => activeTab = 'litellm'}
            class="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === 'litellm' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900'}"
          >
            <Zap class="w-4 h-4" />
            LiteLLM Proxy
          </button>

          <button
            onclick={() => activeTab = 'openrouter'}
            class="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === 'openrouter' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900'}"
          >
            <Globe class="w-4 h-4" />
            OpenRouter
          </button>

          <button
            onclick={() => activeTab = 'mistral'}
            class="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === 'mistral' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200/50 hover:text-gray-900'}"
          >
            <Sparkles class="w-4 h-4" />
            Mistral AI
          </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 p-6 overflow-y-auto scrollbar-thin">
          <div class="max-w-xl">
            <!-- General Tab -->
            {#if activeTab === 'general'}
              <div class="space-y-4">
                <div>
                  <h3 class="font-semibold text-lg text-gray-900 mb-1">General Settings</h3>
                  <p class="text-sm text-gray-500 mb-6">Configure basic translation preferences.</p>
                </div>

                <div class="space-y-3 bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm">
                  <h4 class="font-semibold text-gray-900">Default Model</h4>
                  <p class="text-sm text-gray-500 mb-2">Select the default model to use for translating new books.</p>
                  <select
                    bind:value={settings.defaultModel}
                    class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none bg-white"
                  >
                    {#each modelOptions as opt}
                      <option value={opt.id}>{opt.name}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/if}

            <!-- Advanced Tab -->
            {#if activeTab === 'advanced'}
              <div class="space-y-4">
                <div>
                  <h3 class="font-semibold text-lg text-gray-900 mb-1">Advanced Settings</h3>
                  <p class="text-sm text-gray-500 mb-6">Configure retry logic and concurrency for API calls.</p>
                </div>

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm grid grid-cols-2 gap-5">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5" for="maxRetries">
                      Max Retries
                    </label>
                    <input
                      id="maxRetries"
                      type="number"
                      min="0"
                      bind:value={settings.maxRetries}
                      class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5" for="concurrencyLimit">
                      Concurrency Limit
                    </label>
                    <input
                      id="concurrencyLimit"
                      type="number"
                      min="1"
                      bind:value={settings.concurrencyLimit}
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
            {/if}

            <!-- Custom OpenAI Tab -->
            {#if activeTab === 'custom'}
              <div class="space-y-4">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-1">Custom OpenAI</h3>
                    <p class="text-sm text-gray-500">Configure your custom OpenAI-compatible API settings.</p>
                  </div>
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
                          <span>Test Connection</span>
                      {/if}
                  </button>
                </div>

                {#if testingStatus.custom.error}
                    <div class="text-xs text-red-500 bg-red-50 p-3 rounded-[10px] border border-red-100">{testingStatus.custom.error}</div>
                {/if}

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
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
                      <button type="button" onclick={addKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1 inline-block">
                          + Add another key
                      </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- LiteLLM Tab -->
            {#if activeTab === 'litellm'}
              <div class="space-y-4">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-1">LiteLLM Proxy</h3>
                    <p class="text-sm text-gray-500">Configure your LiteLLM Proxy API settings.</p>
                  </div>
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
                          <span>Test Connection</span>
                      {/if}
                  </button>
                </div>

                {#if testingStatus.litellm.error}
                    <div class="text-xs text-red-500 bg-red-50 p-3 rounded-[10px] border border-red-100">{testingStatus.litellm.error}</div>
                {/if}

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
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
                      <button type="button" onclick={addLitellmKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1 inline-block">
                          + Add another key
                      </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- OpenRouter Tab -->
            {#if activeTab === 'openrouter'}
              <div class="space-y-4">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-1">OpenRouter</h3>
                    <p class="text-sm text-gray-500">Configure your OpenRouter API settings.</p>
                  </div>
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
                          <span>Test Connection</span>
                      {/if}
                  </button>
                </div>

                {#if testingStatus.openrouter.error}
                    <div class="text-xs text-red-500 bg-red-50 p-3 rounded-[10px] border border-red-100">{testingStatus.openrouter.error}</div>
                {/if}

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
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
                      <span class="block text-sm font-medium text-gray-700 mb-1.5">
                        API Keys (round-robin)
                      </span>
                      {#each settings.openrouterKeys as key, i}
                          <div class="flex gap-2 mb-2">
                              <input
                                  type="password"
                                  value={key}
                                  oninput={(e) => handleOpenrouterKeyChange(i, e)}
                                  placeholder="sk-or-v1-..."
                                  class="flex-1 border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                              />
                              <button type="button" onclick={() => removeOpenrouterKey(i)} class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[10px] transition-colors">
                                  <X class="w-4 h-4" />
                              </button>
                          </div>
                      {/each}
                      <button type="button" onclick={addOpenrouterKey} class="text-[#2563eb] hover:text-[#1d4ed8] text-sm font-medium mt-1 inline-block">
                          + Add another key
                      </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Advanced Tab -->
            {#if activeTab === 'advanced'}
              <div class="space-y-4">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-1">Advanced Settings</h3>
                    <p class="text-sm text-gray-500">Global configurations for proxy and other features.</p>
                  </div>
                </div>

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5" for="proxyUrl">
                      Proxy URL
                    </label>
                    <input
                      id="proxyUrl"
                      type="text"
                      bind:value={settings.proxyUrl}
                      placeholder="e.g. socks5://127.0.0.1:1080 or http://127.0.0.1:8080"
                      class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                    />
                    <p class="mt-1 text-xs text-gray-500">Set a global proxy for all external AI API requests.</p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Advanced Tab -->
            {#if activeTab === 'advanced'}
              <div class="space-y-4">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-1">Advanced Settings</h3>
                    <p class="text-sm text-gray-500">Global configurations for proxy and other features.</p>
                  </div>
                </div>

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5" for="proxyUrl">
                      Proxy URL
                    </label>
                    <input
                      id="proxyUrl"
                      type="text"
                      bind:value={settings.proxyUrl}
                      placeholder="e.g. socks5://127.0.0.1:1080 or http://127.0.0.1:8080"
                      class="w-full border border-gray-300 rounded-[10px] p-2.5 text-sm focus:ring-[#2563eb] focus:border-[#2563eb] outline-none"
                    />
                    <p class="mt-1 text-xs text-gray-500">Set a global proxy for all external AI API requests.</p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Mistral AI Tab -->
            {#if activeTab === 'mistral'}
              <div class="space-y-4">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-1">Mistral AI</h3>
                    <p class="text-sm text-gray-500">Configure your Mistral API settings.</p>
                  </div>
                  <button
                    onclick={() => testConnection('mistral')}
                    disabled={testingStatus['mistral']?.loading}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#2563eb] bg-blue-50 hover:bg-blue-100 rounded-[10px] transition-colors disabled:opacity-50"
                  >
                    {#if testingStatus['mistral']?.loading}
                        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2563eb]"></div>
                        <span>Testing...</span>
                    {:else if testingStatus['mistral']?.success}
                        <CheckCircle2 class="w-4 h-4 text-green-500" />
                        <span class="text-green-600">Success</span>
                    {:else if testingStatus['mistral']?.error}
                        <AlertCircle class="w-4 h-4 text-red-500" />
                        <span class="text-red-600">Failed</span>
                    {:else}
                        <Play class="w-4 h-4" />
                        <span>Test Connection</span>
                    {/if}
                  </button>
                </div>

                {#if testingStatus['mistral']?.error}
                    <div class="text-xs text-red-500 bg-red-50 p-3 rounded-[10px] border border-red-100">{testingStatus['mistral'].error}</div>
                {/if}

                <div class="bg-white p-5 rounded-[10px] border border-[#e5e5e5] shadow-sm space-y-4">
                  <div>
                      <span class="block text-sm font-medium text-gray-700 mb-1.5">
                        API Keys (round-robin)
                      </span>
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
            {/if}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[#e5e5e5] flex justify-end gap-3 bg-gray-50/50 shrink-0">
        <button
          onclick={() => dispatch('close')}
          class="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-[10px] transition-colors"
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
