import { PlaceholderScreen } from '../../../components/PlaceholderScreen';
import { useProgressController } from './useProgressController';

export function Progress() {
  const { title, description } = useProgressController();

  return <PlaceholderScreen title={title} description={description} />;
}
