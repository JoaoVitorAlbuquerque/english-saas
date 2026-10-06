import type { FieldIssue } from '../../../curriculum/lib/validation';
import type { Json } from '../../lib/item-form';

/** O que todo editor de conteúdo recebe. Os caminhos dos erros são `content.…`. */
export type TypeEditorProps = {
  content: Json;
  onChange: (content: Json) => void;
  issues: readonly FieldIssue[];
  /** Item publicado ou arquivado: o conteúdo é congelado. */
  readOnly: boolean;
  /** URL do áudio já gerado, quando o item tem (escuta e ditado). */
  audioUrl?: string | null;
};

export type Option = { id: string; text: string; translation?: string };

export type ChoiceContent = {
  options: Option[];
  correctOptionIds: string[];
  shuffle: boolean;
};
