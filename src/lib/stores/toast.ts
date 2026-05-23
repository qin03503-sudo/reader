import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

export const toasts = writable<Toast[]>([]);

export function showToast(type: ToastType, message: string, ttl = 2000) {
  const id = crypto.randomUUID();
  toasts.update(t => [...t, { id, type, message }]);
  setTimeout(() => {
    toasts.update(t => t.filter(toast => toast.id !== id));
  }, ttl);
}
