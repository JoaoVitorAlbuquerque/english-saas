import { Module } from '@nestjs/common';
import type {
  DynamicModule,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';

import {
  ACCESS_POLICY,
  DenyAllAccessPolicy,
  type AccessPolicy,
} from './access-policy';
import {
  CONTENT_GATE,
  DenyAllContentGate,
  type ContentGate,
} from './content-gate';

type Binding<T> = {
  /** Módulo que exporta a implementação. */
  imports: NonNullable<ModuleMetadata['imports']>;
  useExisting: Type<T>;
};

export type AccessModuleOptions = {
  accessPolicy?: Binding<AccessPolicy>;
  contentGate?: Binding<ContentGate>;
};

function bind<T>(
  token: symbol,
  binding: Binding<T> | undefined,
  fallback: Type<T>,
): Provider {
  return binding === undefined
    ? { provide: token, useClass: fallback }
    : { provide: token, useExisting: binding.useExisting };
}

/**
 * Liga os contratos de trava aos módulos que os implementam, sem que quem
 * trava importe quem decide. `@Global`: o curriculum (4) e o learning (6)
 * injetam o token sem importar nada daqui. O que não for ligado cai na
 * implementação que nega tudo.
 */
@Module({})
export class AccessModule {
  static forRoot(options: AccessModuleOptions = {}): DynamicModule {
    return {
      module: AccessModule,
      global: true,
      imports: [
        ...(options.accessPolicy?.imports ?? []),
        ...(options.contentGate?.imports ?? []),
      ],
      providers: [
        bind(ACCESS_POLICY, options.accessPolicy, DenyAllAccessPolicy),
        bind(CONTENT_GATE, options.contentGate, DenyAllContentGate),
      ],
      exports: [ACCESS_POLICY, CONTENT_GATE],
    };
  }
}
