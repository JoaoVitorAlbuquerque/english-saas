import { PlaceholderScreen } from '../../../components/PlaceholderScreen';
import { useTodayController } from './useTodayController';

export function Today() {
  const { title, description } = useTodayController();

  return <PlaceholderScreen title={title} description={description} />;
}
