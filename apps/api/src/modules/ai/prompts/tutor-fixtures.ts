import type { LlmMessage } from '../services/llm.provider';
import type { TutorCorrectionOutput } from './tutor-correction.prompt';
import type { TutorRoleplayTurnOutput } from './tutor-roleplay-turn.prompt';

/**
 * Fixtures do tutor (12) para o FakeLlmProvider. Variam com a entrada — um
 * "tutor de mentira" determinístico, bom o bastante para o e2e provar o
 * mapeamento de erros sem chave da OpenAI.
 *
 * Marcador de teste: um texto com `INAPPROPRIATE_TEST` sai como conteúdo
 * impróprio.
 */

type Json = Record<string, unknown>;

function contextOf(messages: LlmMessage[]): Json {
  const first = messages[0]?.content ?? '';
  const line = first.split('\n')[1] ?? '{}';

  try {
    return JSON.parse(line) as Json;
  } catch {
    return {};
  }
}

function untrusted(content: string, label: string): string {
  const match = new RegExp(
    `<untrusted_content label="${label}">\\n([\\s\\S]*?)\\n</untrusted_content>`,
  ).exec(content);
  return match?.[1] ?? '';
}

function catalogIds(context: Json, key: string): Set<string> {
  const list = (context[key] ?? []) as { id: string }[];
  return new Set(list.map((entry) => entry.id));
}

export function tutorCorrectionFixture(
  messages: LlmMessage[],
): TutorCorrectionOutput {
  const content = messages[0]?.content ?? '';
  const text = untrusted(content, 'student_text');
  const context = contextOf(messages);
  const errors = catalogIds(context, 'errorCatalog');
  const rubric = (context['rubric'] ?? []) as {
    id: string;
    errorPatternId: string | null;
  }[];
  const known = (id: string) => (errors.has(id) ? id : null);

  if (text.includes('INAPPROPRIATE_TEST')) {
    return {
      safety: 'INAPPROPRIATE',
      corrected: '',
      fixes: [],
      rubric: [],
      registerTips: [],
      encouragement: '',
      estimatedLevel: 'A1',
    };
  }

  const fixes: TutorCorrectionOutput['fixes'] = [];
  let corrected = text;

  const age = /I have (\d+) years(?! old)/i.exec(text);
  if (age !== null) {
    const suggestion = `I'm ${age[1] ?? ''} years old`;
    fixes.push({
      original: age[0],
      suggestion,
      explanationPtBr:
        'Em inglês, idade se diz com o verbo "to be", não com "have": "I\'m 22 years old".',
      errorPatternId: known('l1.have-for-age'),
      skillId: 'grammar.be.present.affirmative',
      severity: 'MAJOR',
    });
    corrected = corrected.replace(age[0], suggestion);
  }

  const article = /\b(in|from) the ([A-Z][a-z]+)/.exec(text);
  if (article !== null) {
    const suggestion = `${article[1] ?? ''} ${article[2] ?? ''}`;
    fixes.push({
      original: article[0],
      suggestion,
      explanationPtBr:
        'Nome de cidade e de país (Recife, Brazil) não leva "the" em inglês.',
      errorPatternId: known('article.country-the'),
      skillId: null,
      severity: 'MAJOR',
    });
    corrected = corrected.replace(article[0], suggestion);
  }

  const missingBe = /\bI from\b/.exec(text);
  if (missingBe !== null) {
    fixes.push({
      original: 'I from',
      suggestion: "I'm from",
      explanationPtBr:
        'Faltou o verbo "to be": em inglês a frase precisa dele — "I\'m from Brazil".',
      errorPatternId: null,
      skillId: 'grammar.be.present.affirmative',
      severity: 'MAJOR',
    });
    corrected = corrected.replace('I from', "I'm from");
  }

  if (/(^|\. )i am\b/.test(text)) {
    fixes.push({
      original: 'i am',
      suggestion: 'I am',
      explanationPtBr: 'O "I" (eu) é sempre maiúsculo em inglês.',
      errorPatternId: null,
      skillId: null,
      severity: 'MINOR',
    });
    corrected = corrected.replace(/(^|\. )i am\b/, '$1I am');
  }

  const hitErrors = new Set(fixes.map((fix) => fix.errorPatternId));

  return {
    safety: 'OK',
    corrected,
    fixes,
    rubric: rubric.map((item) => ({
      goalId: item.id,
      met: item.errorPatternId === null || !hitErrors.has(item.errorPatternId),
      comment: 'Fixture do tutor.',
    })),
    registerTips: /I am\b/i.test(corrected)
      ? [
          {
            yourForm: 'I am Ana.',
            naturalSpokenForm: "I'm Ana.",
            standardForm: 'I am Ana.',
            note: 'Na fala, quase sempre sai contraído: "I\'m".',
          },
        ]
      : [],
    encouragement:
      'Boa! Dá pra entender tudo — agora é só ajustar os detalhes.',
    estimatedLevel: 'A1',
  };
}

export function tutorRoleplayTurnFixture(
  messages: LlmMessage[],
): TutorRoleplayTurnOutput {
  const context = contextOf(messages);
  const goals = catalogIds(context, 'goals');
  const expressions = catalogIds(context, 'expressionCatalog');
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const text = untrusted(last?.content ?? '', 'student_turn');

  if (text.includes('INAPPROPRIATE_TEST')) {
    return {
      safety: 'INAPPROPRIATE',
      reply: 'Hmm.',
      goalsMet: [],
      inlineCorrection: null,
      spokenVsStandard: null,
      helpPhrase: null,
      expressionSkillIds: [],
      isFinished: false,
    };
  }

  const met: string[] = [];
  const said = (pattern: RegExp, goal: string) => {
    if (pattern.test(text) && goals.has(goal)) met.push(goal);
  };
  said(/my name is|\bi'?m [A-Z]|\bi am [A-Z]/i, 'tell-name');
  said(/\bfrom\b/i, 'tell-origin');
  said(/\b(yes|no)\b/i, 'answer-yes-no');

  const stuck = text.trim().length < 4 || /n[aã]o sei|\?$/.test(text);
  const age = /I have (\d+) years/i.exec(text);

  return {
    safety: 'OK',
    reply: stuck
      ? 'No worries! Where are you from?'
      : 'Nice to meet you! So, are you new in the building?',
    goalsMet: met,
    inlineCorrection:
      age === null
        ? null
        : {
            original: age[0],
            suggestion: `I'm ${age[1] ?? ''} years old`,
            explanationPtBr: 'Idade em inglês é com "to be", não com "have".',
            errorPatternId: 'l1.have-for-age',
          },
    spokenVsStandard: /are you new/i.test(text)
      ? {
          spoken: 'You new here?',
          standard: 'Are you new here?',
          note: 'Na fala o "are" costuma sumir.',
        }
      : null,
    helpPhrase: stuck ? "I'm from Brazil." : null,
    // Uma do catálogo (se veio) e uma inventada — o tutor precisa descartar.
    expressionSkillIds: [
      ...(met.includes('tell-name') && expressions.has('chunk.my-name-is')
        ? ['chunk.my-name-is']
        : []),
      'chunk.invented-by-ai',
    ],
    isFinished: false,
  };
}
