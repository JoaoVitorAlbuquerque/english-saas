import { useEffect, useRef, useState } from 'react';

const SLOW_PLAYBACK_RATE = 0.75;

export type AudioPlayer = {
  isPlaying: boolean;
  isSlow: boolean;
  playCount: number;
  /** `false` quando `maxPlays` (>0) já foi atingido. */
  canPlay: boolean;
  toggleSlow: () => void;
  play: () => void;
};

/**
 * Tocar/pausar, velocidade lenta e contagem de plays — usado por
 * LISTEN_CHOOSE e DICTATION. Pré-carrega no mount; só toca em interação do
 * aluno (`play`), nunca sozinho.
 */
export function useAudioPlayer(src: string, maxPlays = 0): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = isSlow ? SLOW_PLAYBACK_RATE : 1;
    }
  }, [isSlow]);

  const canPlay = maxPlays <= 0 || playCount < maxPlays;

  function play() {
    const audio = audioRef.current;

    if (!audio || !canPlay) {
      return;
    }

    audio.currentTime = 0;
    void audio.play();
    setIsPlaying(true);
    setPlayCount((count) => count + 1);
  }

  function toggleSlow() {
    setIsSlow((value) => !value);
  }

  return { isPlaying, isSlow, playCount, canPlay, toggleSlow, play };
}
