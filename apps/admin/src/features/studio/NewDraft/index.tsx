import {
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@english-saas/ui';

import { t, type MessageKey } from '../../../messages/pt-BR';
import { ItemsForm } from './ItemsForm';
import { LessonForm } from './LessonForm';
import { NotesForm } from './NotesForm';
import {
  DRAFT_TABS,
  useDraftTab,
  type DraftTab,
} from './useNewDraftController';

const TAB_LABELS: Record<DraftTab, MessageKey> = {
  licao: 'studio.new.tab.lesson',
  questoes: 'studio.new.tab.items',
  notas: 'studio.new.tab.notes',
};

/**
 * Novo rascunho: três pedidos, uma aba para cada. Nada do que a IA gera chega
 * ao aluno antes de uma pessoa aprovar — o texto da tela diz isso.
 */
export function NewDraft() {
  const [tab, setTab] = useDraftTab();

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted">{t('studio.new.intro')}</p>

      <Tabs value={tab} onValueChange={(value) => setTab(value as DraftTab)}>
        <TabsList aria-label={t('studio.new.tabs')}>
          {DRAFT_TABS.map((entry) => (
            <TabsTrigger key={entry} value={entry}>
              {t(TAB_LABELS[entry])}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="licao">
          <Card>
            <LessonForm />
          </Card>
        </TabsContent>
        <TabsContent value="questoes">
          <Card>
            <ItemsForm />
          </Card>
        </TabsContent>
        <TabsContent value="notas">
          <Card>
            <NotesForm />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
