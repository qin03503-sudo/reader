<script lang="ts">
  import { BookOpen, Upload, Trash2, Settings as SettingsIcon } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';
  
  let { globalModel = 'gemini-2.5-flash', books = [] }: { globalModel?: string, books?: any[] } = $props();
  
  const dispatch = createEventDispatcher();
  
  let fileInput: HTMLInputElement;
  let loading = $state(false);

  async function fetchBooks() {
    try {
      const res = await fetch('/api/upload');
      const data = await res.json();
      if (data.books) books = data.books;
    } catch (e) {
      showToast('error', 'Failed to load books');
    }
  }

  onMount(fetchBooks);

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    loading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        await fetchBooks();
        showToast('success', 'Book uploaded successfully');
      } else {
        const error = await res.json();
        showToast('error', error.error || 'Upload failed');
      }
    } catch (error) {
      showToast('error', 'Upload failed');
    } finally {
      loading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function openBook(book: any) {
    dispatch('openBook', book);
  }

  async function deleteBook(id: string) {
    if (!confirm('Are you sure you want to delete this book?')) return;
    try {
      const res = await fetch(`/api/book/${id}`, { method: 'DELETE' });
      if (res.ok) {
        books = books.filter(b => b.id !== id);
        showToast('success', 'Book deleted');
      }
    } catch (e) {
      showToast('error', 'Failed to delete book');
    }
  }
</script>

<div class="min-h-screen bg-[#fcfaf7] p-8 font-sans text-[#1a1a1a]">
  <div class="max-w-6xl mx-auto">
    <header class="flex justify-between items-center mb-12 border-b border-[#e5e5e5] pb-6">
      <div class="flex items-center gap-3">
        <div class="bg-[#2563eb] p-2 rounded-lg">
          <BookOpen class="w-6 h-6 text-white" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Baamboo Reader</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <button
          onclick={() => dispatch('openSettings')}
          class="p-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <SettingsIcon class="w-6 h-6" />
        </button>

        <label class="cursor-pointer bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm {loading ? 'opacity-50 cursor-not-allowed' : ''}">
          <Upload class="w-5 h-5" />
          <span>{loading ? 'Uploading...' : 'Add Book'}</span>
          <input
            bind:this={fileInput}
            type="file"
            accept=".epub"
            class="hidden"
            onchange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>
    </header>

    {#if books.length === 0}
      <div class="text-center py-20 bg-white rounded-2xl border border-[#e5e5e5] shadow-sm">
        <BookOpen class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Your library is empty</h2>
        <p class="text-gray-500 mb-6">Upload an EPUB file to start reading</p>
      </div>
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {#each books as book (book.id)}
          <div class="group relative bg-white rounded-xl border border-[#e5e5e5] overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div 
              class="aspect-[2/3] bg-gray-100 relative cursor-pointer"
              onclick={() => openBook(book)}
              onkeydown={(e) => e.key === 'Enter' && openBook(book)}
              tabindex="0"
              role="button"
            >
              {#if book.coverUrl}
                <img 
                  src={book.coverUrl} 
                  alt={book.title}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center p-4 text-center">
                  <span class="text-gray-400 font-serif text-lg">{book.title}</span>
                </div>
              {/if}
              
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span class="bg-white text-black px-4 py-2 rounded-full font-medium text-sm">
                  Read Now
                </span>
              </div>
            </div>
            
            <div class="p-4 relative">
              <h3 class="font-semibold text-sm line-clamp-1 mb-1" title={book.title}>
                {book.title}
              </h3>
              <p class="text-xs text-gray-500 line-clamp-1">
                {book.author}
              </p>
              
              <button
                onclick={(e) => { e.stopPropagation(); deleteBook(book.id); }}
                class="absolute bottom-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove book"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
