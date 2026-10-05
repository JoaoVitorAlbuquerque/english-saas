import type { SummaryContent } from '@english-saas/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ItemFeedback } from '../items/types';
import { ExplanationCardsView } from './ExplanationCardsView';
import { FreeProductionView } from './FreeProductionView';
import { MarkdownLite } from './MarkdownLite';
import { PracticeView } from './PracticeView';
import { RoleplayView, type RoleplayTurn } from './RoleplayView';
import { SceneView } from './SceneView';
import { SummaryView } from './SummaryView';
import * as fixtures from './fixtures';

describe('SceneView', () => {
  function renderScene(onContinue = vi.fn()) {
    render(
      <SceneView
        content={fixtures.scene}
        characters={fixtures.characters}
        assets={fixtures.assets}
        onContinue={onContinue}
      />,
    );

    return onContinue;
  }

  it('mostra local, resumo, elenco e o áudio da cena inteira', () => {
    renderScene();

    expect(
      screen.getByText('Corredor do prédio, em Austin'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Maya encontra o vizinho novo.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Lucas').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Ouvir a cena inteira' }),
    ).toBeInTheDocument();
  });

  it('a tradução de cada fala abre e fecha sozinha', async () => {
    renderScene();

    expect(screen.queryByText('Você vem?')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Ver tradução' })[0] as HTMLElement,
    );

    expect(screen.getByText('Você vem?')).toBeInTheDocument();
    expect(screen.queryByText('Eu sou o Lucas.')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Esconder tradução' }),
    );

    expect(screen.queryByText('Você vem?')).not.toBeInTheDocument();
  });

  it('fala com standardText alterna entre falado e estrutura gramatical', async () => {
    renderScene();

    expect(screen.getByText('You coming?')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Estrutura gramatical' }),
    );

    expect(screen.getByText('Are you coming?')).toBeInTheDocument();
  });

  it('Continuar avisa quem chamou', async () => {
    const onContinue = renderScene();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('ExplanationCardsView', () => {
  it('navega entre os cards e só conclui no último', async () => {
    const onContinue = vi.fn();
    render(
      <ExplanationCardsView content={fixtures.cards} onContinue={onContinue} />,
    );

    expect(screen.getByRole('heading', { name: 'Verbo to be' })).toBeVisible();
    expect(screen.getByText('Eu sou o Lucas.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Card anterior' }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByRole('heading', { name: 'Forma curta' })).toBeVisible();
    expect(onContinue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('desenha a tabela do card', () => {
    render(
      <ExplanationCardsView content={fixtures.cards} onContinue={vi.fn()} />,
    );

    const table = screen.getByRole('table');

    expect(within(table).getByText('Pessoa')).toBeInTheDocument();
    expect(within(table).getByText('are')).toBeInTheDocument();
  });
});

describe('MarkdownLite', () => {
  it('renderiza negrito, código, riscado e lista', () => {
    const { container } = render(
      <MarkdownLite text={'**forte** `code` ~~fora~~\n\n- um\n- dois'} />,
    );

    expect(container.querySelector('strong')?.textContent).toBe('forte');
    expect(container.querySelector('code')?.textContent).toBe('code');
    expect(container.querySelector('s')?.textContent).toBe('fora');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});

describe('PracticeView', () => {
  const feedback: ItemFeedback = {
    isCorrect: true,
    score: 1,
    verdict: 'CORRECT',
    feedback: 'Isso.',
    explanation: 'Com "I", o verbo é "am".',
    correctAnswer: { optionIds: ['am'], texts: ['am'] },
  };

  it('mostra a primeira questão e avisa a resposta com o id do item', async () => {
    const onAnswer = vi.fn();
    render(
      <PracticeView
        content={fixtures.practice}
        items={fixtures.practiceItems}
        assets={fixtures.assets}
        answeredItemIds={[]}
        answers={{}}
        onAnswer={onAnswer}
        isSubmitting={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText('Questão 1 de 2')).toBeInTheDocument();

    // Múltipla escolha responde ao toque, sem botão de enviar.
    await userEvent.click(screen.getByRole('radio', { name: /am/ }));

    expect(onAnswer).toHaveBeenCalledWith(
      fixtures.ITEM_ID,
      expect.objectContaining({
        response: expect.objectContaining({ optionIds: ['am'] }),
      }),
    );
  });

  it('com a correção na tela, "Continuar" leva para a próxima e depois conclui', async () => {
    const onContinue = vi.fn();
    const props = {
      content: fixtures.practice,
      items: fixtures.practiceItems,
      assets: fixtures.assets,
      answeredItemIds: [],
      onAnswer: vi.fn(),
      isSubmitting: false,
      onContinue,
    };
    const { rerender } = render(<PracticeView {...props} answers={{}} />);

    // A resposta chega depois: a questão na tela só muda no Continuar.
    rerender(
      <PracticeView {...props} answers={{ [fixtures.ITEM_ID]: feedback }} />,
    );

    expect(screen.getByText('Com "I", o verbo é "am".')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('She ___ Lucas.')).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();

    rerender(
      <PracticeView
        {...props}
        answers={{
          [fixtures.ITEM_ID]: feedback,
          [fixtures.ITEM_2_ID]: feedback,
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('FreeProductionView', () => {
  const base = {
    prompt: 'Apresente-se em duas frases.',
    helpers: ["I'm from…", 'Nice to meet you'],
    submitted: false,
    isCorrecting: false,
    creditsExhausted: false,
    result: null,
    notice: null,
    onSubmit: vi.fn(),
    onContinue: vi.fn(),
  };

  it('o chip de ajuda entra no texto e o envio manda o texto aparado', async () => {
    const onSubmit = vi.fn();
    render(<FreeProductionView {...base} onSubmit={onSubmit} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Nice to meet you' }),
    );
    await userEvent.type(screen.getByLabelText('Sua resposta'), ' Lucas.  ');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).toHaveBeenCalledWith('Nice to meet you Lucas.');
  });

  it('com envio desligado (preview) o botão não dispara', async () => {
    const onSubmit = vi.fn();
    render(<FreeProductionView {...base} onSubmit={onSubmit} submitDisabled />);

    await userEvent.type(screen.getByLabelText('Sua resposta'), 'Hi');

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mostra a correção e libera o Continuar', async () => {
    const onContinue = vi.fn();
    render(
      <FreeProductionView
        {...base}
        submitted
        onContinue={onContinue}
        result={{
          corrected: "I'm from Brazil.",
          encouragement: 'Muito bom.',
          fixes: [
            {
              original: 'I am from Brazil',
              suggestion: "I'm from Brazil.",
              explanationPtBr: 'Na fala, a forma curta.',
            },
          ],
          rubric: [{ goalId: 'g1', met: true, comment: 'Disse de onde é.' }],
          registerTips: [],
        }}
      />,
    );

    expect(screen.getByText('Na fala, a forma curta.')).toBeInTheDocument();
    expect(screen.getByText('Cumpriu')).toBeInTheDocument();
    expect(screen.getByText('Versão corrigida')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('sem créditos e com aviso de correção recusada', () => {
    render(
      <FreeProductionView
        {...base}
        submitted
        creditsExhausted
        notice="Não foi possível corrigir."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Você não tem créditos de IA agora',
    );
    expect(screen.getByText('Não foi possível corrigir.')).toBeInTheDocument();
  });
});

describe('RoleplayView', () => {
  const opening: RoleplayTurn = {
    index: 0,
    role: 'CHARACTER',
    text: 'Hi! Are you new here?',
    status: 'DONE',
    feedback: { helpPhrase: "I'm new here.", inlineCorrection: null },
  };

  const base = {
    scenario: 'No elevador do prédio.',
    characterName: 'Maya',
    goals: [{ id: 'name', description: 'Dizer o nome', met: false }],
    turns: [opening],
    turnsLeft: 6,
    finished: false,
    summary: null,
    skillTitle: (id: string) => `Skill ${id}`,
    onSend: vi.fn(),
    onFinish: vi.fn(),
    onContinue: vi.fn(),
  };

  it('mostra cenário, metas e a fala de abertura; manda a resposta aparada', async () => {
    const onSend = vi.fn();
    render(<RoleplayView {...base} onSend={onSend} />);

    expect(screen.getByText('No elevador do prédio.')).toBeInTheDocument();
    expect(screen.getByText('Dizer o nome')).toBeInTheDocument();
    expect(screen.getByText('Hi! Are you new here?')).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText('Escreva sua resposta'),
      '  Yes, I am.  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSend).toHaveBeenCalledWith('Yes, I am.');
    expect(screen.getByLabelText('Escreva sua resposta')).toHaveValue('');
  });

  it('a frase de ajuda preenche o campo', async () => {
    render(<RoleplayView {...base} />);

    await userEvent.click(
      screen.getByRole('button', { name: "Ajuda: I'm new here." }),
    );

    expect(screen.getByLabelText('Escreva sua resposta')).toHaveValue(
      "I'm new here.",
    );
  });

  it('somente leitura (preview): nada anda', () => {
    const onSend = vi.fn();
    render(
      <RoleplayView
        {...base}
        onSend={onSend}
        readOnly
        footer={<p>A conversa por IA não roda aqui.</p>}
      />,
    );

    expect(screen.getByLabelText('Escreva sua resposta')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Encerrar conversa' }),
    ).toBeDisabled();
    expect(
      screen.getByText('A conversa por IA não roda aqui.'),
    ).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('turno pendente e turnos esgotados travam o campo', () => {
    const { rerender } = render(
      <RoleplayView
        {...base}
        turns={[
          opening,
          {
            index: 1,
            role: 'CHARACTER',
            text: '',
            status: 'PENDING',
            feedback: null,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Escreva sua resposta')).toBeDisabled();

    rerender(<RoleplayView {...base} turnsLeft={0} />);

    expect(screen.getByLabelText('Escreva sua resposta')).toBeDisabled();
  });

  it('ao terminar, mostra o resumo e o Continuar', async () => {
    const onContinue = vi.fn();
    render(
      <RoleplayView
        {...base}
        finished
        onContinue={onContinue}
        summary={{
          goals: [{ id: 'name', description: 'Dizer o nome', met: true }],
          topCorrections: [
            {
              original: 'I am agree',
              suggestion: 'I agree',
              explanationPtBr: 'Sem o verbo to be.',
            },
          ],
          expressionSkillIds: ['chunk.nice-to-meet-you'],
        }}
      />,
    );

    expect(screen.getByText('Como foi a conversa')).toBeInTheDocument();
    expect(screen.getByText('Sem o verbo to be.')).toBeInTheDocument();
    expect(
      screen.getByText('Skill chunk.nice-to-meet-you'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Escreva sua resposta'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('SummaryView', () => {
  const content: SummaryContent = fixtures.summary;
  const base = {
    content,
    completed: false,
    onFinish: vi.fn(),
    isFinishing: false,
    xp: 0,
    accuracy: null,
    nextLesson: null,
    onStartNextLesson: vi.fn(),
    onGoToPlan: vi.fn(),
    onRestart: vi.fn(),
    isRestarting: false,
  };

  it('antes de concluir: o que o aluno leva e o botão de concluir', async () => {
    const onFinish = vi.fn();
    render(<SummaryView {...base} onFinish={onFinish} />);

    expect(screen.getByText("I am / I'm")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Concluir lição' }),
    );

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('com concluir desligado (preview) o botão não dispara', () => {
    render(<SummaryView {...base} finishDisabled />);

    expect(
      screen.getByRole('button', { name: 'Concluir lição' }),
    ).toBeDisabled();
  });

  it('depois de concluir: XP, acerto e a próxima lição', async () => {
    const onStartNextLesson = vi.fn();
    render(
      <SummaryView
        {...base}
        completed
        xp={30}
        accuracy={80}
        nextLesson={{ title: 'At the airport' }}
        onStartNextLesson={onStartNextLesson}
      />,
    );

    expect(screen.getByText('30 XP')).toBeInTheDocument();
    expect(screen.getByText('80% de acerto')).toBeInTheDocument();
    expect(screen.getByText('At the airport')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fazer agora' }));

    expect(onStartNextLesson).toHaveBeenCalledTimes(1);
  });
});
