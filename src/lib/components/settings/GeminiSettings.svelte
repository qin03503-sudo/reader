<script lang="ts">
  import ProviderSettings from './ProviderSettings.svelte';

  let { settings = $bindable() }: { settings: any } = $props();
</script>

<ProviderSettings
  title="Google Gemini"
  description="Fast, reliable translations using Gemini Flash."
  hasTestConnection={false}
  hasBaseUrl={false}
  hasModelName={false}
  bind:keys={settings.geminiKeys}
  keyPlaceholder="AIzaSy..."
/>
