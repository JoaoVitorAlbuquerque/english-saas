import { Gauge, Play } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { useAnswerTimer } from '../hooks/use-answer-timer';
import { useAudioPlayer } from '../hooks/use-audio-player';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { DictationItemView, ItemTypeProps } from '../types';

export function DictationItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<DictationItemView>) {
  const [text, setText] = useState('');
  const audio = useAudioPlayer(item.content.audioUrl, item.content.maxPlays);
  const elapsed = useAnswerTimer();

  const isPreview = mode === 'preview';
  const answered = isPreview || feedback != null;
  const isInteractive = !disabled && !answered;

  function submit() {
    if (!isInteractive || text.trim().length === 0) {
      return;
    }

    onAnswer?.({
      response: { text },
      responseTimeMs: elapsed(),
      hintsUsed: 0,
    });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink">{item.prompt}</p>

      <div className="flex items-center gap-2">
        <Button
          disabled={disabled || !audio.canPlay}
          onClick={audio.play}
          leftIcon={<Play className="size-4" aria-hidden="true" />}
        >
          {audio.playCount === 0 ? 'Ouvir' : 'Ouvir de novo'}
        </Button>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-pressed={audio.isSlow}
          onClick={audio.toggleSlow}
          leftIcon={<Gauge className="size-4" aria-hidden="true" />}
        >
          Devagar
        </Button>
        {item.content.maxPlays > 0 ? (
          <span className="text-sm text-muted">
            {Math.max(item.content.maxPlays - audio.playCount, 0)} de{' '}
            {item.content.maxPlays} restantes
          </span>
        ) : null}
      </div>

      <Input
        aria-label="Escreva o que você ouviu"
        value={text}
        disabled={!isInteractive}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />

      {feedback ? <ItemFeedbackPanel feedback={feedback} /> : null}
    </div>
  );
}
