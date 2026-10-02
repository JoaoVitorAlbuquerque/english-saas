import {
  useLogout,
  useLogoutAll,
  useProfile,
  useUpdateAccount,
  useUpdateProfile,
} from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useAuthStore } from '../../../stores/auth-store';
import { timezoneOptions } from '../lib/timezones';

const MIN_NAME_LENGTH = 2;

export function useProfileController() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  const profile = useProfile();
  const updateAccount = useUpdateAccount();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();
  const logoutAll = useLogoutAll();

  // `null` = a pessoa ainda não mexeu: o campo mostra o valor do servidor.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isLogoutAllOpen, setLogoutAllOpen] = useState(false);

  const savedName = user?.name ?? '';
  const savedTimezone = profile.data?.timezone ?? '';
  const name = nameDraft ?? savedName;
  const timezone = timezoneDraft ?? savedTimezone;

  const trimmedName = name.trim();
  const nameChanged = nameDraft !== null && trimmedName !== savedName;
  const timezoneChanged = timezoneDraft !== null && timezone !== savedTimezone;
  const nameError =
    nameChanged && trimmedName.length < MIN_NAME_LENGTH
      ? t('profile.account.nameInvalid')
      : undefined;

  async function save() {
    if (nameError !== undefined || user === null) {
      return;
    }

    setSaveError(null);

    try {
      if (nameChanged) {
        const updated = await updateAccount.mutateAsync({ name: trimmedName });
        setSession({ ...user, name: updated.name });
        setNameDraft(null);
      }

      if (timezoneChanged) {
        await updateProfile.mutateAsync({ timezone });
        setTimezoneDraft(null);
      }

      toast.success({ title: t('profile.account.saved') });
    } catch {
      setSaveError(t('profile.account.saveError'));
    }
  }

  /** Sessão encerrada no servidor: some tudo que era deste aluno e volta ao login. */
  function leave() {
    clearSession();
    navigate('/login', { replace: true });
    queryClient.clear();
  }

  async function handleLogout() {
    setSessionError(null);

    try {
      await logout.mutateAsync();
      leave();
    } catch {
      setSessionError(t('profile.session.logoutError'));
    }
  }

  async function confirmLogoutAll() {
    setSessionError(null);

    try {
      await logoutAll.mutateAsync();
      setLogoutAllOpen(false);
      leave();
    } catch {
      setLogoutAllOpen(false);
      setSessionError(t('profile.session.logoutError'));
    }
  }

  return {
    isLoading: profile.isLoading,
    isError: profile.isError,
    retry: () => void profile.refetch(),
    user,
    name,
    setName: setNameDraft,
    nameError,
    timezone,
    setTimezone: setTimezoneDraft,
    timezoneOptions: timezoneOptions(timezone || savedTimezone),
    canSave:
      (nameChanged || timezoneChanged) &&
      nameError === undefined &&
      !updateAccount.isPending &&
      !updateProfile.isPending,
    isSaving: updateAccount.isPending || updateProfile.isPending,
    save: () => void save(),
    saveError,
    sessionError,
    isLoggingOut: logout.isPending,
    handleLogout: () => void handleLogout(),
    isLogoutAllOpen,
    openLogoutAll: () => setLogoutAllOpen(true),
    closeLogoutAll: () => setLogoutAllOpen(false),
    isLoggingOutAll: logoutAll.isPending,
    confirmLogoutAll: () => void confirmLogoutAll(),
  };
}
