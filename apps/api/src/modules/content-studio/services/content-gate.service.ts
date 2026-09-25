import { Injectable } from '@nestjs/common';

import type { ContentGate } from 'src/common/access/content-gate';

import { MissingAudioError, QaBlockersError } from '../content-studio.errors';
import { blockers, type QaWarning } from '../domain/qa-report';
import { QaService } from './qa.service';
import { TtsService } from './tts.service';

/**
 * As duas travas que o content-studio impõe ao fluxo do módulo 4.
 *
 * - **Aprovar** é recusado quando a QA achou bloqueador.
 * - **Publicar** é recusado quando falta áudio — uma lição muda no ar é pior
 *   que uma lição atrasada.
 *
 * QA que nunca rodou **não** impede aprovação: lição escrita à mão por um
 * editor não passa por rascunho de IA, e exigir o relatório ali seria
 * inventar burocracia onde não há risco.
 */
@Injectable()
export class ContentStudioGate implements ContentGate {
  constructor(
    private readonly qa: QaService,
    private readonly tts: TtsService,
  ) {}

  async assertCanApprove(lessonVersionId: string): Promise<void> {
    const report = await this.qa.latestOrNull(lessonVersionId);

    if (report === null || report.blockerCount === 0) {
      return;
    }

    const warnings = Array.isArray(report.warnings)
      ? (report.warnings as unknown as QaWarning[])
      : [];

    throw new QaBlockersError(blockers(warnings));
  }

  async assertCanPublish(lessonVersionId: string): Promise<void> {
    const pending = await this.tts.pendingAudio(lessonVersionId);

    if (pending.length > 0) {
      throw new MissingAudioError(pending);
    }
  }
}
