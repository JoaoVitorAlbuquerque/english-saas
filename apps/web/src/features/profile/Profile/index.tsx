import { PlaceholderScreen } from '../../../components/PlaceholderScreen';
import { useProfileController } from './useProfileController';

export function Profile() {
  const { title, description, user } = useProfileController();

  return (
    <div className="flex flex-col gap-4">
      {user ? (
        <p className="text-sm text-muted">Logado como {user.name}</p>
      ) : null}
      <PlaceholderScreen title={title} description={description} />
    </div>
  );
}
