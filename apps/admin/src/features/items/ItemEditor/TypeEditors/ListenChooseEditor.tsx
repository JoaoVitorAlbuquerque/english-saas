import { AudioTextField } from './AudioTextField';
import { ChoiceEditor } from './ChoiceEditor';
import type { TypeEditorProps } from './types';

/** O aluno ouve e escolhe a alternativa certa. */
export function ListenChooseEditor(props: TypeEditorProps) {
  return (
    <div className="space-y-5">
      <AudioTextField {...props} />
      <ChoiceEditor {...props} />
    </div>
  );
}
