import { t } from '../../../messages/pt-BR';
import { BackToProfile } from '../components/BackToProfile';
import { ConsentsSection } from './ConsentsSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { ExportSection } from './ExportSection';
import { usePrivacyController } from './usePrivacyController';

export function Privacy() {
  const { consents, dataExport, deletion } = usePrivacyController();

  return (
    <div className="flex flex-col gap-6">
      <BackToProfile />
      <h1 className="font-display text-xl text-ink">
        {t('profile.privacy.title')}
      </h1>

      <ConsentsSection consents={consents} />
      <ExportSection dataExport={dataExport} />
      <DeleteAccountSection deletion={deletion} />
    </div>
  );
}
