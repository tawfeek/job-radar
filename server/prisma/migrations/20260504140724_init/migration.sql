-- CreateTable
CREATE TABLE "job_search_profiles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "keywords" TEXT[],
    "exclude_kw" TEXT[],
    "location" VARCHAR(100) NOT NULL DEFAULT 'Israel',
    "remote_ok" BOOLEAN NOT NULL DEFAULT true,
    "min_years_exp" INTEGER,
    "max_results" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_search_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "model" VARCHAR(100),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "postings_found" INTEGER NOT NULL DEFAULT 0,
    "postings_new" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "last_run_id" TEXT,
    "title" VARCHAR(300) NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT[],
    "source_url" VARCHAR(500) NOT NULL,
    "source_name" VARCHAR(200) NOT NULL,
    "posted_at" TIMESTAMP(3),
    "freshness" VARCHAR(20) NOT NULL,
    "match_score" DOUBLE PRECISION,
    "match_reason" TEXT,
    "user_status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "user_notes" TEXT,
    "applied_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_profile_id_status_finished_at_idx" ON "job_runs"("profile_id", "status", "finished_at");

-- CreateIndex
CREATE INDEX "job_postings_profile_id_user_status_first_seen_at_idx" ON "job_postings"("profile_id", "user_status", "first_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_profile_id_source_url_key" ON "job_postings"("profile_id", "source_url");

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "job_search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
