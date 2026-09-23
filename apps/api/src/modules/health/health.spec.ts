import { summarizeHealth } from './domain/summarize-health';

describe('summarizeHealth', () => {
  it('retorna ok quando todas as dependências estão de pé', () => {
    expect(
      summarizeHealth({
        database: { status: 'up', latencyMs: 3 },
        redis: { status: 'up', latencyMs: 1 },
      }),
    ).toBe('ok');
  });

  it('retorna error quando qualquer dependência está fora', () => {
    expect(
      summarizeHealth({
        database: { status: 'up', latencyMs: 3 },
        redis: { status: 'down', error: 'ECONNREFUSED' },
      }),
    ).toBe('error');
  });

  it('retorna ok quando não há dependências a checar', () => {
    expect(summarizeHealth({})).toBe('ok');
  });
});
