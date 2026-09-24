import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env';

/**
 * Acesso tipado às variáveis de ambiente já validadas.
 * Use este serviço em vez de ler `process.env` direto.
 */
@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    const value = this.configService.get(key, { infer: true });

    // O ConfigService cai de volta no process.env quando o valor validado é
    // undefined — e aí uma chave escrita como `RESEND_API_KEY=` volta como
    // string vazia em vez de ausente. Para o schema, vazio é ausente.
    if (typeof value === 'string' && value.trim() === '') {
      return undefined as Env[K];
    }

    return value;
  }

  /** A variável está preenchida? Vazio conta como ausente. */
  has<K extends keyof Env>(key: K): boolean {
    return this.get(key) !== undefined;
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}
