<script lang="ts">
  import { CheckCircle2, AlertCircle, X, Info } from '@lucide/svelte';
  import { toasts } from '$lib/stores/toast';

  function remove(id: string) {
    toasts.update(t => t.filter(toast => toast.id !== id));
  }
</script>

{#each $toasts as toast (toast.id)}
  <div
    class="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all animate-slide-up"
    class:bg-green-50={toast.type === 'success'}
    class:border-green-200={toast.type === 'success'}
    class:text-green-800={toast.type === 'success'}
    class:bg-red-50={toast.type === 'error'}
    class:border-red-200={toast.type === 'error'}
    class:text-red-800={toast.type === 'error'}
    class:bg-blue-50={toast.type === 'info'}
    class:border-blue-200={toast.type === 'info'}
    class:text-blue-800={toast.type === 'info'}
  >
    {#if toast.type === 'success'}
      <CheckCircle2 class="w-5 h-5 text-green-500 shrink-0" />
    {:else if toast.type === 'error'}
      <AlertCircle class="w-5 h-5 text-red-500 shrink-0" />
    {:else}
      <Info class="w-5 h-5 text-blue-500 shrink-0" />
    {/if}
    <span class="text-sm font-medium">{toast.message}</span>
    <button onclick={() => remove(toast.id)} class="ml-2 p-0.5 rounded-full hover:bg-black/10 transition-colors shrink-0">
      <X class="w-4 h-4" />
    </button>
  </div>
{/each}

<style>
  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
