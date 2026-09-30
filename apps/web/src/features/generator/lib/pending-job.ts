/**
 * O último pedido de material em andamento, só para o atalho "retomar" do
 * hub. A fonte da verdade é a URL `/ferramentas/pedidos/:jobId` e a API —
 * isto é conveniência por navegador e pode sumir (aba anônima, limpeza de
 * dados) sem quebrar nada.
 */
const STORAGE_KEY = 'generator.pendingJobId';

export function readPendingJobId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function savePendingJobId(jobId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, jobId);
  } catch {
    // Sem storage: o acompanhamento continua pela URL.
  }
}

export function clearPendingJobId(jobId?: string): void {
  try {
    if (jobId === undefined || readPendingJobId() === jobId) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Idem.
  }
}
