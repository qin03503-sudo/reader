<script lang="ts">
  import ProviderSettings from './ProviderSettings.svelte';

  let {
    settings = $bindable(),
    testingStatus,
    onTestConnection
  }: {
    settings: any,
    testingStatus: { loading: boolean, success?: boolean, error?: string },
    onTestConnection: () => void
  } = $props();
</script>

<ProviderSettings
  title="Custom OpenAI Compatible API"
  description="Connect to any OpenAI-compatible endpoint (vLLM, Ollama, etc)."
  hasTestConnection={true}
  hasBaseUrl={true}
  hasModelName={true}
  bind:baseUrl={settings.openaiBaseUrl}
  bind:modelName={settings.openaiModel}
  bind:keys={settings.openaiKeys}
  bind:legacyKey={settings.openaiKey}
  {testingStatus}
  {onTestConnection}
  baseUrlPlaceholder="https://api.openai.com/v1"
  modelPlaceholder="e.g. gpt-4o"
/>
