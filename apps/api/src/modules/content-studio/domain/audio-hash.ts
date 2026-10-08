import { createHash } from 'node:crypto';

/**
 * Identidade de um áudio: hash(texto normalizado + voz).
 *
 * TTS é produção única. A mesma fala, com a mesma voz e a mesma velocidade,
 * nunca é sintetizada duas vezes — nem quando a lição ganha uma versão nova
 * e as falas são clonadas. É o que faz republicar uma lição custar zero.
 *
 * A normalização é conservadora de propósito: caixa e espaço não mudam o que
 * se ouve, mas **pontuação muda** ("Nice to meet you." × "Nice to meet
 * you?") e por isso fica no hash.
 */

export type AudioIdentity = {
  text: string;
  voiceId: string;
  /** Velocidade de fala. Entra no hash: 0.9 e 1.0 soam diferente. */
  speakingRate?: number;
  /**
   * Só a "nova geração" usa: força um áudio novo para o mesmo texto, voz e
   * velocidade. Ausente, o hash é idêntico ao de antes do campo existir —
   * nenhum áudio já produzido é invalidado.
   */
  salt?: string;
};

/** Caixa e espaço sobrando não mudam o áudio; o resto muda. */
export function normalizeAudioText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function audioHash(identity: AudioIdentity): string {
  const rate = identity.speakingRate ?? 1;

  return createHash('sha256')
    .update(
      JSON.stringify({
        text: normalizeAudioText(identity.text),
        voiceId: identity.voiceId,
        rate: Number(rate.toFixed(2)),
        ...(identity.salt === undefined ? {} : { salt: identity.salt }),
      }),
    )
    .digest('hex');
}
