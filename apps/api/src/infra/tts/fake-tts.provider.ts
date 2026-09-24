import { Injectable } from '@nestjs/common';

import {
  TtsProvider,
  type SynthesizeInput,
  type SynthesizeResult,
  type TtsCapabilities,
} from './tts.provider';

/**
 * Provedor de mentira para dev e teste.
 *
 * Gera um WAV **válido** e silencioso, com duração proporcional ao texto.
 * Válido de propósito: o arquivo vai para o MinIO e o player do front
 * consegue abrir, então dá para montar a lição inteira em dev sem contratar
 * fornecedor nenhum. E resolve a pendência do módulo 4, em que os
 * `MediaAsset` do seed apontavam para objeto que não existia.
 *
 * Determinístico: mesmo texto e mesma voz produzem o mesmo byte, o que faz
 * o cache por hash ser testável.
 */

const SAMPLE_RATE = 16_000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

/** Fala corrida em inglês fica perto de 15 caracteres por segundo. */
const MS_PER_CHAR = 66;
const MIN_DURATION_MS = 300;
const MAX_DURATION_MS = 60_000;

export function estimateDurationMs(text: string, speakingRate = 1): number {
  const rate = speakingRate > 0 ? speakingRate : 1;
  const raw = (text.trim().length * MS_PER_CHAR) / rate;

  return Math.min(Math.max(Math.round(raw), MIN_DURATION_MS), MAX_DURATION_MS);
}

/** Cabeçalho RIFF de 44 bytes + PCM zerado. */
export function buildSilentWav(durationMs: number): Buffer {
  const frames = Math.round((SAMPLE_RATE * durationMs) / 1_000);
  const bytesPerFrame = (BITS_PER_SAMPLE / 8) * CHANNELS;
  const dataSize = frames * bytesPerFrame;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');

  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // tamanho do bloco fmt
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerFrame, 28); // byte rate
  buffer.writeUInt16LE(bytesPerFrame, 32); // block align
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);

  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  // O resto já é zero — silêncio em PCM assinado.
  return buffer;
}

@Injectable()
export class FakeTtsProvider extends TtsProvider {
  readonly name = 'fake';

  /**
   * Diz que suporta tudo para o caminho completo ser exercitado no teste:
   * o `TtsService` monta SSML e lexicon, e o fake recebe — mesmo que o
   * áudio resultante seja silêncio.
   */
  readonly capabilities: TtsCapabilities = {
    ssml: true,
    lexicon: true,
    speakingRate: true,
  };

  synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const durationMs = estimateDurationMs(input.text, input.speakingRate);

    return Promise.resolve({
      audio: buildSilentWav(durationMs),
      mimeType: 'audio/wav',
      durationMs,
      provider: this.name,
      charCount: input.text.length,
    });
  }
}
