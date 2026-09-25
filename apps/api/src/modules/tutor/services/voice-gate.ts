import { Injectable } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { InvalidAudioError, VoiceDisabledError } from '../tutor.errors';
import { AUDIO_TYPES } from './correction.service';

/** O que o multer entrega. Local: o projeto não depende de `@types/multer`. */
export type UploadedAudio = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

/**
 * Porta de entrada da voz: a flag (`TUTOR_VOICE_ENABLED`, desligada por
 * padrão), o formato e o tamanho. Só MP3/M4A/AAC — o que toca em qualquer
 * navegador, inclusive no Safari do iPhone.
 */
@Injectable()
export class VoiceGate {
  constructor(private readonly envService: EnvService) {}

  accept(file: UploadedAudio | undefined): {
    buffer: Buffer;
    mimeType: string;
    extension: string;
  } {
    if (!this.envService.get('TUTOR_VOICE_ENABLED')) {
      throw new VoiceDisabledError();
    }

    const maxBytes = this.envService.get('TUTOR_AUDIO_MAX_BYTES');
    const extension = file?.originalname.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = AUDIO_TYPES[extension];

    if (file === undefined || mimeType === undefined || file.size > maxBytes) {
      throw new InvalidAudioError(maxBytes);
    }

    return { buffer: file.buffer, mimeType, extension };
  }
}
