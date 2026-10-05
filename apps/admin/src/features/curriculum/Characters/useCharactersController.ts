import {
  type AdminCharacter,
  useAdminCharacters,
} from '@english-saas/api-client';
import { useState } from 'react';

export function useCharactersController() {
  const characters = useAdminCharacters();
  // `undefined`: fechado; `null`: criando; personagem: editando.
  const [dialog, setDialog] = useState<AdminCharacter | null | undefined>(
    undefined,
  );

  return {
    isLoading: characters.isPending,
    error: characters.error,
    characters: characters.data ?? [],
    retry: () => void characters.refetch(),
    dialog,
    openCreate: () => setDialog(null),
    openEdit: (character: AdminCharacter) => setDialog(character),
    closeDialog: () => setDialog(undefined),
  };
}
