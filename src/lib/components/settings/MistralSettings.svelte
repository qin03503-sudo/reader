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
  title="Mistral AI"
  description="Configure your Mistral API settings."
  hasTestConnection={true}
  hasBaseUrl={false}
  hasModelName={true}
  bind:modelName={settings.mistralModel}
  bind:keys={settings.mistralKeys}
  bind:legacyKey={settings.mistralKey}
  {testingStatus}
  {onTestConnection}
  modelPlaceholder="e.g. mistral-large-latest"
/>
