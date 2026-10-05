import type { Story } from '@ladle/react';

import { ExplanationCardsView } from './ExplanationCardsView';
import { FreeProductionView } from './FreeProductionView';
import { PracticeView } from './PracticeView';
import { RoleplayView } from './RoleplayView';
import { SceneView } from './SceneView';
import { SummaryView } from './SummaryView';
import * as fixtures from './fixtures';

const noop = () => undefined;

export const Scene: Story = () => (
  <SceneView
    content={fixtures.scene}
    characters={fixtures.characters}
    assets={fixtures.assets}
    onContinue={noop}
  />
);

export const ExplanationCards: Story = () => (
  <ExplanationCardsView content={fixtures.cards} onContinue={noop} />
);

export const Practice: Story = () => (
  <PracticeView
    content={fixtures.practice}
    items={fixtures.practiceItems}
    assets={fixtures.assets}
    answeredItemIds={[]}
    answers={{}}
    onAnswer={noop}
    isSubmitting={false}
    onContinue={noop}
  />
);

export const FreeProduction: Story = () => (
  <FreeProductionView
    prompt="Apresente-se em duas frases."
    helpers={["I'm from…", 'Nice to meet you']}
    minWords={10}
    submitted={false}
    isCorrecting={false}
    creditsExhausted={false}
    result={null}
    notice={null}
    onSubmit={noop}
    onContinue={noop}
  />
);

export const FreeProductionPreview: Story = () => (
  <FreeProductionView
    prompt="Apresente-se em duas frases."
    helpers={["I'm from…", 'Nice to meet you']}
    submitted={false}
    isCorrecting={false}
    creditsExhausted={false}
    result={null}
    notice={null}
    onSubmit={noop}
    onContinue={noop}
    submitDisabled
    footer={
      <p className="text-xs text-muted">
        Prévia: a correção por IA não roda aqui.
      </p>
    }
  />
);

export const Roleplay: Story = () => (
  <RoleplayView
    scenario="No elevador do prédio, você encontra a vizinha."
    characterName="Maya"
    goals={[
      { id: 'name', description: 'Dizer o nome', met: true },
      { id: 'from', description: 'Dizer de onde é', met: false },
    ]}
    turns={[
      {
        index: 0,
        role: 'CHARACTER',
        text: 'Hi! Are you new here?',
        status: 'DONE',
        feedback: { helpPhrase: "I'm new here.", inlineCorrection: null },
      },
      {
        index: 1,
        role: 'STUDENT',
        text: 'Yes, I am Lucas.',
        status: 'DONE',
        feedback: null,
      },
    ]}
    turnsLeft={4}
    finished={false}
    summary={null}
    skillTitle={(id) => id}
    onSend={noop}
    onFinish={noop}
    onContinue={noop}
  />
);

export const Summary: Story = () => (
  <SummaryView
    content={fixtures.summary}
    completed={false}
    onFinish={noop}
    isFinishing={false}
    xp={0}
    accuracy={null}
    nextLesson={null}
    onStartNextLesson={noop}
    onGoToPlan={noop}
    onRestart={noop}
    isRestarting={false}
  />
);

export const SummaryCompleted: Story = () => (
  <SummaryView
    content={fixtures.summary}
    completed
    onFinish={noop}
    isFinishing={false}
    xp={30}
    accuracy={80}
    nextLesson={{ title: 'At the airport' }}
    onStartNextLesson={noop}
    onGoToPlan={noop}
    onRestart={noop}
    isRestarting={false}
  />
);
