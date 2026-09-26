import { cn } from '../../lib/cn';

export type CharacterTone = 'maya' | 'lucas' | 'neutral';

export type CharacterAvatarProps = {
  name: string;
  tone?: CharacterTone;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const TONE_CLASSES: Record<CharacterTone, string> = {
  maya: 'bg-maya/15 text-maya ring-maya/40',
  lucas: 'bg-lucas/15 text-lucas ring-lucas/40',
  neutral: 'bg-line/60 text-ink ring-line',
};

const SIZE_CLASSES = {
  sm: 'size-8 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-lg',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function CharacterAvatar({
  name,
  tone = 'neutral',
  imageUrl,
  size = 'md',
  className,
}: CharacterAvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium ring-2',
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
