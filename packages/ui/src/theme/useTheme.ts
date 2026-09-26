import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'english-saas:theme';
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

let preference: ThemePreference = readPreference();

function applyToDocument(next: ThemePreference): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (next === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', next);
  }
}

function setPreference(next: ThemePreference): void {
  preference = next;
  applyToDocument(next);

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Modo privado ou storage bloqueado: o tema só não sobrevive ao reload.
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot(): ThemePreference {
  return preference;
}

/**
 * Tema do aluno: 'light' | 'dark' fixam `data-theme`; 'system' remove o
 * atributo e deixa `prefers-color-scheme` decidir (ver tokens.css).
 */
export function useTheme(): {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
} {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): ThemePreference => 'system',
  );

  useEffect(() => {
    applyToDocument(preference);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  return { theme, setTheme };
}
