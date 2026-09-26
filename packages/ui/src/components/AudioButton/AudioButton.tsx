import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';

export type AudioButtonProps = {
  src: string;
  label?: string;
  className?: string;
};

/** Botão de tocar/pausar um áudio (cena, fala, frase de flashcard). */
export function AudioButton({
  src,
  label = 'Ouvir áudio',
  className,
}: AudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play();
      setIsPlaying(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isPlaying}
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90',
        className,
      )}
    >
      {isPlaying ? (
        <Pause className="size-5" aria-hidden="true" />
      ) : (
        <Play className="size-5 translate-x-0.5" aria-hidden="true" />
      )}
    </button>
  );
}
