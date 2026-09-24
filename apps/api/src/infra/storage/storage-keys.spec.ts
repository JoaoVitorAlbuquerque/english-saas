import {
  STORAGE_PREFIXES,
  buildStorageKey,
  isValidStorageKey,
} from './storage-keys';

describe('buildStorageKey', () => {
  it('prefixa e junta os segmentos', () => {
    expect(
      buildStorageKey(STORAGE_PREFIXES.CONTENT, 'lessons', 'abc', 'scene.mp3'),
    ).toBe('content/lessons/abc/scene.mp3');
  });

  it('tira acento e normaliza para minúsculas', () => {
    expect(buildStorageKey(STORAGE_PREFIXES.EXPORTS, 'Relatório Final')).toBe(
      'exports/relatorio-final',
    );
  });

  it('achata segmento que já vem com barra', () => {
    expect(buildStorageKey(STORAGE_PREFIXES.UPLOADS, 'user/1/redacao')).toBe(
      'uploads/user/1/redacao',
    );
  });

  it('descarta segmento que sobra vazio depois da limpeza', () => {
    expect(buildStorageKey(STORAGE_PREFIXES.GENERATED, '///', 'ok')).toBe(
      'generated/ok',
    );
  });

  it('recusa chave sem nenhum segmento aproveitável', () => {
    expect(() => buildStorageKey(STORAGE_PREFIXES.CONTENT, '!!!')).toThrow(
      'ao menos um segmento',
    );
  });
});

describe('isValidStorageKey', () => {
  it('aceita chave sob um prefixo conhecido', () => {
    expect(isValidStorageKey('content/lessons/a.mp3')).toBe(true);
  });

  it('recusa prefixo desconhecido', () => {
    expect(isValidStorageKey('random/a.mp3')).toBe(false);
  });

  it('recusa chave solta na raiz do bucket', () => {
    expect(isValidStorageKey('content')).toBe(false);
  });
});
