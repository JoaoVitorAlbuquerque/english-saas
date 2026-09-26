export type ToastTone = 'default' | 'ok' | 'error';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastInput = {
  title: string;
  description?: string;
};

const listeners = new Set<(toasts: ToastItem[]) => void>();
let toasts: ToastItem[] = [];

function emit(): void {
  listeners.forEach((listener) => listener(toasts));
}

function push(tone: ToastTone, input: ToastInput): void {
  const item: ToastItem = { id: crypto.randomUUID(), tone, ...input };
  toasts = [...toasts, item];
  emit();
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function subscribeToasts(
  listener: (toasts: ToastItem[]) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export const toast = {
  message: (input: ToastInput) => push('default', input),
  success: (input: ToastInput) => push('ok', input),
  error: (input: ToastInput) => push('error', input),
};
