import { ChoiceQuestion } from '../ChoiceQuestion';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { ItemTypeProps, MultipleChoiceItemView } from '../types';

export function MultipleChoiceItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<MultipleChoiceItemView>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg text-ink">{item.prompt}</p>
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
