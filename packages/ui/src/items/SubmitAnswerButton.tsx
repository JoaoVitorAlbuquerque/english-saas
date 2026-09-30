import { Button } from '../components/Button/Button';

export type SubmitAnswerButtonProps = {
  onClick: () => void;
  /** Resposta ainda vazia ou incompleta. */
  disabled: boolean;
};

/**
 * "Enviar" das questões em que o aluno digita ou monta a resposta. O Enter
 * continua valendo no teclado, mas no celular não existe Enter confiável —
 * o botão é o caminho de todo mundo.
 */
export function SubmitAnswerButton({
  onClick,
  disabled,
}: SubmitAnswerButtonProps) {
  return (
    <Button
      className="w-full sm:w-auto sm:self-start"
      disabled={disabled}
      onClick={onClick}
    >
      Enviar
    </Button>
  );
}
