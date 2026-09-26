import { EmptyState } from '@english-saas/ui';

export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="pt-8">
      <EmptyState title={title} description={description} />
    </div>
  );
}
