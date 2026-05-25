<script lang="ts">
  import { BookOpen, Upload, Settings as SettingsIcon } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { showToast } from '$lib/stores/toast';
  import BookCard from './library/BookCard.svelte';
  
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
          <BookCard
            {book}
            onOpen={openBook}
            onDelete={deleteBook}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>
