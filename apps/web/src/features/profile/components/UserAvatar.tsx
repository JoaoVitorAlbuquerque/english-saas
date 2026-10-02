import { initialsOf } from '../lib/initials';

/** Avatar com as iniciais do nome — ainda não há upload de foto. Decorativo. */
export function UserAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 font-display text-xl text-accent"
    >
      {initialsOf(name)}
    </span>
  );
}
