<script lang="ts">
  import { X, Settings, Sliders, Cpu, Zap, Globe, Sparkles } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';
  import GeneralSettings from './settings/GeneralSettings.svelte';
  import GeminiSettings from './settings/GeminiSettings.svelte';
  import OpenAISettings from './settings/OpenAISettings.svelte';
  import LiteLLMSettings from './settings/LiteLLMSettings.svelte';
  import OpenRouterSettings from './settings/OpenRouterSettings.svelte';
  import MistralSettings from './settings/MistralSettings.svelte';

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
    openrouterKeys: [] as string[],
    openrouterModel: 'deepseek/deepseek-chat',
    mistralKey: '',
    mistralKeys: [] as string[],
    mistralModel: 'mistral-large-latest',
    geminiKeys: [] as string[],
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
      openrouter: { loading: false },
      mistral: { loading: false }
  });

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
      if (!settings.openrouterKeys) settings.openrouterKeys = [];
      if (!settings.openaiBaseUrl) settings.openaiBaseUrl = '';
      if (!settings.openaiModel) settings.openaiModel = 'deepseek-chat';
      if (!settings.litellmModel) settings.litellmModel = 'deepseek-chat';
      if (!settings.openrouterModel) settings.openrouterModel = 'deepseek/deepseek-chat';
      if (!settings.mistralKey) settings.mistralKey = '';
      if (!settings.mistralKeys) settings.mistralKeys = [];
      if (!settings.geminiKeys) settings.geminiKeys = [];
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
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast('success', 'Settings saved successfully');
        dispatch('close');
      } else {
        const error = await res.json();
        showToast('error', error.error || 'Failed to save settings');
      }
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
              key: settings.openrouterKeys[0] || settings.openrouterKey,
              model: settings.openrouterModel
          };
      } else if (provider === 'mistral') {
          config = {
              key: settings.mistralKeys[0] || settings.mistralKey,
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
          if (res.ok && data.success) {
               testingStatus[provider] = { loading: false, success: true };
               setTimeout(() => {
                   if(testingStatus[provider]) testingStatus[provider] = { loading: false };
               }, 3000);
          } else {
               testingStatus[provider] = { loading: false, error: data.error || 'Connection failed' };
          }
      } catch (e: any) {
          testingStatus[provider] = { loading: false, error: e.message || 'Network error' };
      }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'gemini', label: 'Google Gemini', icon: Sparkles },
    { id: 'custom', label: 'Custom OpenAI', icon: Cpu },
    { id: 'litellm', label: 'LiteLLM', icon: Zap },
    { id: 'openrouter', label: 'OpenRouter', icon: Globe },
    { id: 'mistral', label: 'Mistral AI', icon: Sparkles }
  ];
</script>

{#if show}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
    <div class="bg-[#fcfaf7] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-[#e5e5e5]">

      <!-- Header -->
      <div class="px-6 py-5 border-b border-[#e5e5e5] flex justify-between items-center bg-white shrink-0">
        <div class="flex items-center gap-3">
          <div class="bg-gray-100 p-2 rounded-lg">
            <Settings class="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 leading-tight">Settings</h2>
            <p class="text-sm text-gray-500">Manage your translation models and preferences</p>
          </div>
        </div>
        <button
          onclick={() => dispatch('close')}
          class="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          title="Close"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar Navigation -->
        <div class="w-64 bg-white border-r border-[#e5e5e5] p-4 overflow-y-auto shrink-0">
          <nav class="space-y-1">
            {#each tabs as tab}
              <button
                onclick={() => activeTab = tab.id}
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors {activeTab === tab.id ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
              >
                <tab.icon class="w-4 h-4 {activeTab === tab.id ? 'text-white/90' : 'text-gray-400'}" />
                {tab.label}
              </button>
            {/each}
          </nav>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto bg-[#fcfaf7] p-8">
          <div class="max-w-2xl mx-auto">
            {#if activeTab === 'general'}
              <GeneralSettings bind:settings={settings} />
            {:else if activeTab === 'gemini'}
              <GeminiSettings bind:settings={settings} />
            {:else if activeTab === 'custom'}
              <OpenAISettings
                bind:settings={settings}
                testingStatus={testingStatus['custom']}
                onTestConnection={() => testConnection('custom')}
              />
            {:else if activeTab === 'litellm'}
              <LiteLLMSettings
                bind:settings={settings}
                testingStatus={testingStatus['litellm']}
                onTestConnection={() => testConnection('litellm')}
              />
            {:else if activeTab === 'openrouter'}
              <OpenRouterSettings
                bind:settings={settings}
                testingStatus={testingStatus['openrouter']}
                onTestConnection={() => testConnection('openrouter')}
              />
            {:else if activeTab === 'mistral'}
              <MistralSettings
                bind:settings={settings}
                testingStatus={testingStatus['mistral']}
                onTestConnection={() => testConnection('mistral')}
              />
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
