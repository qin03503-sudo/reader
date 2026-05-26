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
  title="LiteLLM Proxy"
  description="Connect to your LiteLLM proxy server."
  hasTestConnection={true}
  hasBaseUrl={true}
  hasModelName={true}
  bind:baseUrl={settings.litellmBaseUrl}
  bind:modelName={settings.litellmModel}
  bind:keys={settings.litellmKeys}
  {testingStatus}
  {onTestConnection}
  baseUrlPlaceholder="http://localhost:4000"
  modelPlaceholder="e.g. gpt-4"
/>
