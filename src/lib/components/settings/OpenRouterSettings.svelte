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
  title="OpenRouter"
  description="Configure your OpenRouter API settings."
  hasTestConnection={true}
  hasBaseUrl={false}
  hasModelName={true}
  bind:modelName={settings.openrouterModel}
  bind:keys={settings.openrouterKeys}
  bind:legacyKey={settings.openrouterKey}
  {testingStatus}
  {onTestConnection}
  modelPlaceholder="e.g. deepseek/deepseek-chat"
  keyPlaceholder="sk-or-v1-..."
/>
