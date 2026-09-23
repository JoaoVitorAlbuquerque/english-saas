import globals from 'globals';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

export const nest = tseslint.config(
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // Um provider injetado só aparece como anotação de tipo no construtor.
      // Trocá-lo por `import type` apaga o `design:paramtypes` que o Nest usa
      // para resolver a dependência — e o erro só aparece em runtime.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Decorators do Nest exigem classes só de metadados e parâmetros
      // que o linter não enxerga como usados.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Convenção do projeto: `domain/` guarda regra de negócio pura.
    // Não conhece Nest, Prisma, HTTP, fila nem nada de framework.
    files: ['**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                '@prisma/*',
                'prisma',
                'bullmq',
                'ioredis',
                'express',
                'openai',
                '**/infra/**',
              ],
              message:
                'domain/ contém regra pura: sem framework, I/O ou infraestrutura. Mova a dependência para services/.',
            },
          ],
        },
      ],
    },
  },
);

export default nest;
