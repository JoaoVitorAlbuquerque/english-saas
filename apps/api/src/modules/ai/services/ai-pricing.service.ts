import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import {
  computeCostUsdMicros,
  findModelPricing,
  type PricingTable,
  type TokenUsage,
} from '../domain/cost';

/**
 * Tabela de preços por modelo.
 *
 * Os valores vêm do `AI_PRICING_JSON` — nunca ficam fixos no código, porque
 * a OpenAI muda preço sem avisar e não queremos deploy para corrigir custo.
 */
@Injectable()
export class AiPricingService {
  private readonly logger = new Logger(AiPricingService.name);
  private readonly table: PricingTable;
  private readonly warnedModels = new Set<string>();

  constructor(envService: EnvService) {
    this.table = envService.get('AI_PRICING_JSON');
  }

  computeCostUsdMicros(model: string, usage: TokenUsage): number {
    if (
      findModelPricing(this.table, model) === undefined &&
      !this.warnedModels.has(model)
    ) {
      this.warnedModels.add(model);
      this.logger.warn(
        { model },
        'Modelo sem preço em AI_PRICING_JSON: o custo será registrado como 0',
      );
    }

    return computeCostUsdMicros(this.table, model, usage);
  }

  get pricingTable(): PricingTable {
    return this.table;
  }
}
