import type { ZodError } from 'zod';

/**
 * Reparo de JSON que não passou no schema.
 *
 * A política do CLAUDE.md: falhou o parse, refaz a chamada com o erro de
 * validação junto; falhou de novo, o job falha. Uma tentativa, não um laço.
 */

export const MAX_REPAIR_ATTEMPTS = 1;

/** Resume as issues do zod num texto curto e acionável para o modelo. */
export function describeZodIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `- ${path}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Mensagem de reparo enviada ao modelo. Em inglês: é instrução para ele.
 *
 * Não repete o conteúdo do aluno — só o que saiu errado e o que se espera.
 */
export function buildRepairInstruction(error: ZodError): string {
  return [
    'Your previous answer did not match the required JSON schema.',
    'Validation errors:',
    describeZodIssues(error),
    '',
    'Return a corrected JSON object that satisfies the schema exactly.',
    'Do not explain, apologise, or add any text outside the JSON.',
  ].join('\n');
}

/**
 * Extrai o objeto JSON de uma resposta de texto.
 *
 * Com `response_format: json_schema` o conteúdo já vem JSON puro, mas o
 * modelo às vezes embrulha em cerca de código — e o fake provider e os
 * modelos mais antigos também. Isso aqui é a rede de segurança.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Última tentativa: o primeiro objeto ou array balanceado do texto.
    const start = withoutFence.search(/[[{]/);

    if (start === -1) {
      throw new SyntaxError('A resposta da IA não contém JSON.');
    }

    const opening = withoutFence[start];
    const closing = opening === '{' ? '}' : ']';
    const end = withoutFence.lastIndexOf(closing);

    if (end <= start) {
      throw new SyntaxError('A resposta da IA não contém JSON completo.');
    }

    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}
