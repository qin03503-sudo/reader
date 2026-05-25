<script lang="ts">
  import { Trash2 } from '@lucide/svelte';

  let { book, onOpen, onDelete } = $props<{
    book: any;
    onOpen: (book: any) => void;
    onDelete: (id: string) => void;
  }>();

  function handleDelete(e: Event) {
    e.stopPropagation();
    onDelete(book.id);
  }

  function handleOpen() {
    onOpen(book);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleOpen();
    }
  }
</script>

<div class="group relative bg-white rounded-xl border border-[#e5e5e5] overflow-hidden shadow-sm hover:shadow-md transition-all">
  <div
    class="aspect-[2/3] bg-gray-100 relative cursor-pointer"
    onclick={handleOpen}
    onkeydown={handleKeydown}
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
      onclick={handleDelete}
      class="absolute bottom-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      title="Remove book"
    >
      <Trash2 class="w-4 h-4" />
    </button>
  </div>
</div>
