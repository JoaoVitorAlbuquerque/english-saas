import { Injectable } from '@nestjs/common';

/**
 * Transcrição de voz para o tutor. Só o contrato e o fake existem: o
 * fornecedor de verdade entra como mais uma implementação, escolhida por
 * `SPEECH_TO_TEXT_PROVIDER`, sem tocar em quem chama.
 */
export abstract class SpeechToText {
  abstract transcribe(input: {
    audio: Buffer;
    mimeType: string;
    languageHint: 'en';
  }): Promise<{ text: string }>;
}

/**
 * Não ouve nada: devolve uma frase fixa. Serve para exercitar o caminho
 * áudio → storage → job → correção sem fornecedor.
 */
@Injectable()
export class FakeSpeechToText extends SpeechToText {
  transcribe(): Promise<{ text: string }> {
    return Promise.resolve({
      text: 'Hi! I am from Brazil and I have 22 years.',
    });
  }
}
