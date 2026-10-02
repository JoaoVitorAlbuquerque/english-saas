import {
  clearAccessToken,
  useConsents,
  useDeleteAccount,
  useLatestExport,
  useProfile,
  useRequestExport,
  useUpdateConsent,
  type ConsentView,
} from '@english-saas/api-client';
import {
  ANONYMIZATION_GRACE_DAYS,
  CONSENT_TYPES,
  REQUIRED_CONSENTS,
  type ConsentType,
} from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useAuthStore } from '../../../stores/auth-store';
import { useSessionNoticeStore } from '../../../stores/session-notice-store';
import { formatBytes, formatInstant } from '../lib/dates';
import { exportStateOf } from '../lib/export-status';

const CONSENT_LABELS = {
  TERMS: 'profile.privacy.consentTERMS',
  PRIVACY_POLICY: 'profile.privacy.consentPRIVACY_POLICY',
  DATA_PERSONALIZATION: 'profile.privacy.consentDATA_PERSONALIZATION',
  MARKETING: 'profile.privacy.consentMARKETING',
} as const satisfies Record<ConsentType, Parameters<typeof t>[0]>;

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export type ConsentRow = {
  type: ConsentType;
  label: string;
  required: boolean;
  granted: boolean;
  outdated: boolean;
  /** Quando e em que versão — ou que ainda não respondeu. */
  status: string;
};

export function usePrivacyController() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const setAccountDeleted = useSessionNoticeStore(
    (state) => state.setAccountDeleted,
  );

  const profile = useProfile();
  const consents = useConsents();
  const updateConsent = useUpdateConsent();
  const latestExport = useLatestExport();
  const requestExport = useRequestExport();
  const deleteAccount = useDeleteAccount();

  const [isRevokeOpen, setRevokeOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE;

  // --- Consentimentos --------------------------------------------------

  function describeConsent(view: ConsentView): string {
    if (view.granted && view.grantedAt !== null) {
      return t('profile.privacy.consentGranted', {
        date: formatInstant(view.grantedAt, timezone).split(' ')[0] ?? '',
        version: view.version,
      });
    }

    if (view.revokedAt !== null) {
      return t('profile.privacy.consentRevoked', {
        date: formatInstant(view.revokedAt, timezone).split(' ')[0] ?? '',
      });
    }

    return t('profile.privacy.consentNever');
  }

  const consentRows: ConsentRow[] = CONSENT_TYPES.flatMap((type) => {
    const view = consents.data?.find((item) => item.type === type);

    return view === undefined
      ? []
      : [
          {
            type,
            label: t(CONSENT_LABELS[type]),
            required: REQUIRED_CONSENTS.includes(type),
            granted: view.granted,
            outdated: !view.upToDate,
            status: describeConsent(view),
          },
        ];
  });

  async function applyConsent(type: ConsentType, granted: boolean) {
    try {
      await updateConsent.mutateAsync({ type, granted });
    } catch {
      toast.error({ title: t('profile.privacy.consentError') });
    }
  }

  function setConsent(type: ConsentType, granted: boolean) {
    // Retirar a personalização é a única que pede confirmação: é o que a
    // plataforma entrega, e a pessoa pode não ter percebido.
    if (type === 'DATA_PERSONALIZATION' && !granted) {
      setRevokeOpen(true);
      return;
    }

    void applyConsent(type, granted);
  }

  async function confirmRevoke() {
    await applyConsent('DATA_PERSONALIZATION', false);
    setRevokeOpen(false);
  }

  // --- Exportar ---------------------------------------------------------

  const exportView = latestExport.data ?? null;
  const exportState = exportStateOf(exportView);

  async function handleRequestExport() {
    setExportError(null);

    try {
      await requestExport.mutateAsync();
    } catch {
      setExportError(t('profile.export.requestError'));
    }
  }

  // --- Excluir a conta --------------------------------------------------

  function openDelete() {
    setConfirmText('');
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    setDeleteError(null);

    try {
      const result = await deleteAccount.mutateAsync();

      // A API já derrubou as sessões. Aqui some o que é deste aluno e a
      // pessoa cai no login, com o recado do prazo.
      clearAccessToken();
      setAccountDeleted({
        anonymizeAt: result.anonymizeAt,
        daysRemaining: result.daysRemaining,
      });
      clearSession();
      navigate('/login', { replace: true });
      queryClient.clear();
    } catch {
      setDeleteError(t('profile.delete.error'));
    }
  }

  const confirmWord = t('profile.delete.confirmWord');

  return {
    consents: {
      isLoading: consents.isLoading,
      isError: consents.isError,
      retry: () => void consents.refetch(),
      rows: consentRows,
      isSaving: updateConsent.isPending,
      setConsent,
      /** Aceita a versão nova de um documento que o aluno já tinha aceito. */
      acceptNewVersion: (type: ConsentType) => void applyConsent(type, true),
      isRevokeOpen,
      closeRevoke: () => setRevokeOpen(false),
      confirmRevoke: () => void confirmRevoke(),
    },
    dataExport: {
      state: exportState,
      isChecking: latestExport.isLoading,
      checkFailed: latestExport.isError,
      isRequesting: requestExport.isPending,
      error: exportError,
      request: () => void handleRequestExport(),
      readyInfo:
        exportView !== null && exportView.status === 'READY'
          ? t('profile.export.readyInfo', {
              size:
                exportView.sizeBytes === null
                  ? '—'
                  : formatBytes(exportView.sizeBytes),
              date:
                exportView.expiresAt === null
                  ? '—'
                  : formatInstant(exportView.expiresAt, timezone),
            })
          : null,
    },
    deletion: {
      days: ANONYMIZATION_GRACE_DAYS,
      isOpen: isDeleteOpen,
      open: openDelete,
      close: () => setDeleteOpen(false),
      confirmWord,
      confirmText,
      setConfirmText,
      canConfirm: confirmText.trim().toUpperCase() === confirmWord,
      isDeleting: deleteAccount.isPending,
      error: deleteError,
      confirm: () => void confirmDelete(),
    },
  };
}
