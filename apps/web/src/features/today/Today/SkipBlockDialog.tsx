import type { AgendaSkipReason } from '@english-saas/api-client';
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Textarea,
} from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';

const REASONS: AgendaSkipReason[] = [
  'NO_TIME',
  'ALREADY_KNOW',
  'TOO_HARD',
  'OTHER',
];

const REASON_LABEL: Record<AgendaSkipReason, string> = {
  NO_TIME: t('today.skipDialog.reason.NO_TIME'),
  ALREADY_KNOW: t('today.skipDialog.reason.ALREADY_KNOW'),
  TOO_HARD: t('today.skipDialog.reason.TOO_HARD'),
  OTHER: t('today.skipDialog.reason.OTHER'),
};

export type SkipBlockDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: AgendaSkipReason, note?: string) => void;
  isSkipping: boolean;
};

export function SkipBlockDialog({
  open,
  onClose,
  onConfirm,
  isSkipping,
}: SkipBlockDialogProps) {
  const [reason, setReason] = useState<AgendaSkipReason | undefined>(undefined);
  const [note, setNote] = useState('');

  function handleOpenChange(next: boolean): void {
    if (!next) {
      setReason(undefined);
      setNote('');
      onClose();
    }
  }

  function handleConfirm(): void {
    onConfirm(
      reason,
      reason === 'OTHER' && note.trim() ? note.trim() : undefined,
    );
    setReason(undefined);
    setNote('');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {t('today.skipDialog.title')}
        </DialogTitle>

        <div className="mt-4 flex flex-wrap gap-2">
          {REASONS.map((candidate) => (
            <Chip
              key={candidate}
              selected={reason === candidate}
              onClick={() => setReason(candidate)}
            >
              {REASON_LABEL[candidate]}
            </Chip>
          ))}
        </div>

        {reason === 'OTHER' ? (
          <Textarea
            className="mt-3"
            placeholder={t('today.skipDialog.notePlaceholder')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('today.skipDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} isLoading={isSkipping}>
            {t('today.skipDialog.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
