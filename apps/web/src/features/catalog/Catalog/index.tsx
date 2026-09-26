import { PlaceholderScreen } from '../../../components/PlaceholderScreen';
import { useCatalogController } from './useCatalogController';

export function Catalog() {
  const { title, description } = useCatalogController();

  return <PlaceholderScreen title={title} description={description} />;
}
