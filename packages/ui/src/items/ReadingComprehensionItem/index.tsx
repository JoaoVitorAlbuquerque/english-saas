import { Card } from '../../components/Card/Card';
import { MarkedText } from '../../components/MarkedText/MarkedText';
import { ChoiceQuestion } from '../ChoiceQuestion';
import { ItemFeedbackPanel } from '../ItemFeedbackPanel';
import type { ItemTypeProps, ReadingComprehensionItemView } from '../types';

export function ReadingComprehensionItem({
  item,
  mode,
  onAnswer,
  feedback,
  disabled,
}: ItemTypeProps<ReadingComprehensionItemView>) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <MarkedText
          text={item.content.passage}
          spans={item.content.spans}
          className="leading-relaxed text-ink"
        />
      </Card>

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
