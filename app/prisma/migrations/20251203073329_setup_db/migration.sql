-- CreateTable
CREATE TABLE "user" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "first_name" TEXT,
    "last_name" TEXT,
    "country" TEXT,
    "gender" TEXT,
    "dob" TIMESTAMP(6),
    "email" TEXT,
    "profile_picture_url" TEXT,
    "phone_number" JSONB,
    "auth_type" TEXT,
    "password" TEXT NOT NULL,
    "is_email_verified" BOOLEAN DEFAULT false,
    "is_phone_verified" BOOLEAN DEFAULT false,
    "email_verified_at" TIMESTAMP(6),
    "phone_number_verified_at" TIMESTAMP(6),
    "last_sign_in_at" TIMESTAMP(6),
    "bio" TEXT,
    "theme" TEXT,
    "profile_accessibility" TEXT,
    "user_type" TEXT,
    "user_name" TEXT,
    "language" TEXT,
    "status" TEXT DEFAULT 'INACTIVE',
    "timezone" TEXT,
    "invited_by_user_id" UUID,
    "is_protected" BOOLEAN DEFAULT false,
    "is_trashed" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT false,
    "is_verified" BOOLEAN DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "permission" (
    "permission_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "codename" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "group" (
    "group_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "codename" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "group_permission" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "log_id" UUID NOT NULL,
    "user_id" UUID,
    "level" VARCHAR(20) NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "action" VARCHAR(100),
    "module" VARCHAR(50),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "device" VARCHAR(100),
    "browser" VARCHAR(100),
    "os" VARCHAR(100),
    "platform" VARCHAR(50),
    "endpoint" VARCHAR(255),
    "method" VARCHAR(10),
    "status_code" INTEGER,
    "request_id" VARCHAR(100),
    "session_id" VARCHAR(100),
    "metadata" JSONB,
    "error_details" JSONB,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "user_group" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" UUID,

    CONSTRAINT "user_group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_user_name_key" ON "user"("user_name");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_user_name_idx" ON "user"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_name_key" ON "permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_codename_key" ON "permission"("codename");

-- CreateIndex
CREATE INDEX "permission_codename_idx" ON "permission"("codename");

-- CreateIndex
CREATE INDEX "permission_category_idx" ON "permission"("category");

-- CreateIndex
CREATE UNIQUE INDEX "group_name_key" ON "group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "group_codename_key" ON "group"("codename");

-- CreateIndex
CREATE INDEX "group_codename_idx" ON "group"("codename");

-- CreateIndex
CREATE INDEX "group_is_active_idx" ON "group"("is_active");

-- CreateIndex
CREATE INDEX "group_permission_group_id_idx" ON "group_permission"("group_id");

-- CreateIndex
CREATE INDEX "group_permission_permission_id_idx" ON "group_permission"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_permission_group_id_permission_id_key" ON "group_permission"("group_id", "permission_id");

-- CreateIndex
CREATE INDEX "activity_log_user_id_idx" ON "activity_log"("user_id");

-- CreateIndex
CREATE INDEX "activity_log_level_idx" ON "activity_log"("level");

-- CreateIndex
CREATE INDEX "activity_log_action_idx" ON "activity_log"("action");

-- CreateIndex
CREATE INDEX "activity_log_module_idx" ON "activity_log"("module");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- CreateIndex
CREATE INDEX "activity_log_ip_address_idx" ON "activity_log"("ip_address");

-- CreateIndex
CREATE INDEX "activity_log_request_id_idx" ON "activity_log"("request_id");

-- CreateIndex
CREATE INDEX "activity_log_session_id_idx" ON "activity_log"("session_id");

-- CreateIndex
CREATE INDEX "user_group_user_id_idx" ON "user_group"("user_id");

-- CreateIndex
CREATE INDEX "user_group_group_id_idx" ON "user_group"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_user_id_group_id_key" ON "user_group"("user_id", "group_id");

-- AddForeignKey
ALTER TABLE "group_permission" ADD CONSTRAINT "group_permission_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permission" ADD CONSTRAINT "group_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
