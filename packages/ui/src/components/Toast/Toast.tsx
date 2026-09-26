import * as RadixToast from '@radix-ui/react-toast';
import { useSyncExternalStore } from 'react';

import { cn } from '../../lib/cn';
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastTone,
} from './toast-store';

const TONE_CLASSES: Record<ToastTone, string> = {
  default: 'border-line',
  ok: 'border-ok',
  error: 'border-error',
};

/** Monte uma vez na raiz do app. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);

  return (
    <RadixToast.Provider swipeDirection="right" duration={5000}>
      {toasts.map((item) => (
        <RadixToast.Root
          key={item.id}
          className={cn(
            'rounded-xl border-l-4 bg-surface p-4 shadow-lg',
            TONE_CLASSES[item.tone],
          )}
          onOpenChange={(open) => {
            if (!open) {
              dismissToast(item.id);
            }
          }}
        >
          <RadixToast.Title className="text-sm font-medium text-ink">
            {item.title}
          </RadixToast.Title>
          {item.description ? (
            <RadixToast.Description className="mt-1 text-sm text-muted">
              {item.description}
            </RadixToast.Description>
          ) : null}
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="fixed bottom-0 right-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </RadixToast.Provider>
  );
}
