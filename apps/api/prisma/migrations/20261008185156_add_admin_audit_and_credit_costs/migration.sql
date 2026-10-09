-- CreateTable
CREATE TABLE "ai_credit_costs" (
    "feature" "feature" NOT NULL,
    "cost" INTEGER NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credit_costs_pkey" PRIMARY KEY ("feature")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_id_created_at_idx" ON "admin_audit_logs"("target_id", "created_at");
