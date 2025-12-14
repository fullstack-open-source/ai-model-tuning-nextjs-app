-- CreateTable
CREATE TABLE IF NOT EXISTS "project_settings" (
    "id" SERIAL NOT NULL,
    "project_id" TEXT,
    "name" TEXT,
    "title" TEXT,
    "base_url" TEXT,
    "support_email" TEXT,
    "support_contact" TEXT,
    "company_address" TEXT,
    "logo" TEXT,
    "hlogo" TEXT,
    "flogo" TEXT,
    "facebook" TEXT,
    "twitter" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "youtube" TEXT,
    "tiktok" TEXT,
    "whatsapp" TEXT,
    "vimeo" TEXT,
    "pinterest" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "meta_keywords" TEXT,
    "head_meta_data" TEXT,
    "body_meta_data" TEXT,
    "extra_meta_data" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_settings_project_id_key" ON "project_settings"("project_id");

