import * as RadixDialog from '@radix-ui/react-dialog';

import { cn } from '../../lib/cn';

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;
export const SheetTitle = RadixDialog.Title;
export const SheetDescription = RadixDialog.Description;

/** Painel que sobe do rodapé — usado no celular no lugar de um Dialog centralizado. */
export function SheetContent({
  className,
  children,
  ...props
}: RadixDialog.DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <RadixDialog.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg focus:outline-none',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line"
        />
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
