/**
 * Contrato de síntese de voz.
 *
 * TTS aqui é **produção**, não runtime: o áudio é gerado uma vez, quando o
 * editor aprova a versão, e vira arquivo no bucket. Nenhum aluno dispara
 * síntese — se disparasse, o custo escalaria com o número de alunos em vez
 * de com o número de falas.
 *
 * A implementação concreta fica atrás desta classe abstrata. Hoje só existe
 * o `FakeTtsProvider`; o adapter do fornecedor de verdade entra sem tocar em
 * nenhum chamador.
 */

/**
 * Pronúncia customizada de um termo.
 *
 * Nome de personagem e de lugar são o caso real: "Campinas" e "Biscuit"
 * saem errados em voz treinada só em inglês. Provedor que não suporta
 * lexicon ignora o campo — quem manda não precisa saber.
 */
export type TtsLexiconEntry = {
  /** Como está escrito no texto. */
  grapheme: string;
  /** Pronúncia em IPA, quando o provedor aceita. */
  ipa?: string;
  /** Substituição literal, para quem só aceita alias. */
  alias?: string;
};

export type TtsFormat = 'mp3' | 'wav';

export type SynthesizeInput = {
  /** Texto puro. Ignorado quando `ssml` vem preenchido. */
  text: string;
  /** Voz do personagem — vem de `Character.voiceId`. */
  voiceId: string;
  /**
   * SSML, para controlar pausa e ênfase. Só é usado se
   * `capabilities.ssml` for true; senão o provedor cai no `text`.
   */
  ssml?: string;
  lexicon?: TtsLexiconEntry[];
  format?: TtsFormat;
  /** 1 = velocidade natural. Abaixo disso, fala pausada para A1. */
  speakingRate?: number;
};

export type SynthesizeResult = {
  audio: Buffer;
  mimeType: string;
  durationMs: number;
  /** Nome do provedor, gravado junto do áudio para auditoria. */
  provider: string;
  /** Quantos caracteres foram cobrados. */
  charCount: number;
};

export type TtsCapabilities = {
  ssml: boolean;
  lexicon: boolean;
  speakingRate: boolean;
};

export abstract class TtsProvider {
  abstract readonly name: string;
  abstract readonly capabilities: TtsCapabilities;

  abstract synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}
