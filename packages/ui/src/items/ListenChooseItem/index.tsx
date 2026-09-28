import { Gauge, Play } from 'lucide-react';

import { Button } from '../../components/Button/Button';
import { ChoiceQuestion } from '../ChoiceQuestion';
import { useAudioPlayer } from '../hooks/use-audio-player';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { ItemTypeProps, ListenChooseItemView } from '../types';

export function ListenChooseItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<ListenChooseItemView>) {
  const audio = useAudioPlayer(item.content.audioUrl);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink">{item.prompt}</p>
      <div className="flex items-center gap-2">
        <Button
          disabled={disabled}
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
      </div>
      <ChoiceQuestion
        options={item.content.options}
        mode={mode}
        onAnswer={onAnswer}
        feedback={feedback}
        disabled={disabled}
      />
      {feedback ? <ItemFeedbackPanel feedback={feedback} /> : null}
    </div>
  );
}
