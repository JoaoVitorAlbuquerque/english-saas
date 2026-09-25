-- CreateEnum
CREATE TYPE "plan_tier" AS ENUM ('free', 'base', 'plus');

-- CreateEnum
CREATE TYPE "billing_period" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('pending', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('pix', 'boleto', 'credit_card');

-- CreateEnum
CREATE TYPE "ai_credit_entry_kind" AS ENUM ('grant', 'consume', 'refund', 'bonus');

-- CreateEnum
CREATE TYPE "feature" AS ENUM ('lesson_access', 'tutor_correction', 'tutor_roleplay', 'generator_topic', 'generator_ingest', 'pdf_download');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "tier" "plan_tier" NOT NULL,
    "billing_period" "billing_period",
    "price_cents" INTEGER NOT NULL,
    "monthly_ai_credits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "tier" "plan_tier" NOT NULL,
    "billing_period" "billing_period" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'pending',
    "asaas_customer_id" TEXT,
    "asaas_subscription_id" TEXT,
    "checkout_url" TEXT,
    "current_period_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credit_ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ai_credit_entry_kind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "feature" "feature",
    "reason" TEXT,
    "reversal_of_id" UUID,
    "cycle_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_webhook_events" (
    "id" UUID NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asaas_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_tier_billing_period_key" ON "subscription_plans"("tier", "billing_period");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_asaas_subscription_id_key" ON "subscriptions"("asaas_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_created_at_idx" ON "subscriptions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_ledger_entries_reversal_of_id_key" ON "ai_credit_ledger_entries"("reversal_of_id");

-- CreateIndex
CREATE INDEX "ai_credit_ledger_entries_user_id_created_at_idx" ON "ai_credit_ledger_entries"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_ledger_entries_user_id_kind_cycle_key_key" ON "ai_credit_ledger_entries"("user_id", "kind", "cycle_key");

-- CreateIndex
CREATE UNIQUE INDEX "asaas_webhook_events_external_event_id_key" ON "asaas_webhook_events"("external_event_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credit_ledger_entries" ADD CONSTRAINT "ai_credit_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credit_ledger_entries" ADD CONSTRAINT "ai_credit_ledger_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "ai_credit_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Escrito à mão: o Prisma não expressa índice parcial.
-- No máximo uma assinatura em aberto por aluno. É o que torna o checkout
-- seguro sob dois cliques simultâneos.
CREATE UNIQUE INDEX "subscriptions_one_open_per_user"
  ON "subscriptions"("user_id")
  WHERE "status" IN ('pending', 'active', 'past_due');
