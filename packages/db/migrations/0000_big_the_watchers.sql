CREATE TYPE "public"."call_outcome" AS ENUM('connected', 'no_answer', 'voicemail', 'booked_meeting', 'not_interested', 'callback', 'wrong_number', 'dnc');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('unknown', 'opted_in', 'opted_out', 'dnc');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'sent');--> statement-breakpoint
CREATE TYPE "public"."outreach_channel" AS ENUM('email', 'linkedin', 'voice', 'sms');--> statement-breakpoint
CREATE TYPE "public"."scrape_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('tech_stack', 'hiring', 'funding', 'traffic', 'review', 'social', 'news', 'website_audit');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."vendor_event_type" AS ENUM('lead_created', 'call_scheduled', 'call_started', 'call_completed', 'call_failed', 'voicemail', 'callback_requested', 'dnc_requested');--> statement-breakpoint
CREATE TYPE "public"."vendor_name" AS ENUM('salescloser', 'vapi', 'retell', 'twilio', 'mock');--> statement-breakpoint
CREATE TABLE "prospect_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"domain" text NOT NULL,
	"legal_name" text,
	"display_name" text NOT NULL,
	"industry" text,
	"employee_range" text,
	"country" text,
	"region" text,
	"hq_city" text,
	"linkedin_url" text,
	"enrichment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "prospect_accounts_domain_unique" UNIQUE("domain"),
	CONSTRAINT "prospect_accounts_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "prospect_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"title" text,
	"seniority" text,
	"email" text,
	"email_status" text DEFAULT 'unverified' NOT NULL,
	"phone" text,
	"linkedin_url" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"consent_status" "consent_status" DEFAULT 'unknown' NOT NULL,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "prospect_contacts_account_dedupe_uq" UNIQUE("account_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"actor_run_id" text,
	"apify_dataset_id" text,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "scrape_run_status" DEFAULT 'queued' NOT NULL,
	"requested_by" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "prospect_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid,
	"scrape_run_id" uuid,
	"type" "signal_type" NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight" numeric(6, 2) DEFAULT '1' NOT NULL,
	"source" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closer_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"tier" text NOT NULL,
	"rationale" text,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signals_hash" text NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closer_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"score_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"summary" text NOT NULL,
	"pain_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value_props" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"talk_track" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_channel" "outreach_channel" DEFAULT 'voice' NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"brief_id" uuid,
	"channel" "outreach_channel" DEFAULT 'voice' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" "draft_status" DEFAULT 'pending_approval' NOT NULL,
	"reviewer_id" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"scheduled_for" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "compliance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"lawful_basis" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vendor" "vendor_name" NOT NULL,
	"event_type" "vendor_event_type" NOT NULL,
	"account_id" uuid,
	"contact_id" uuid,
	"draft_id" uuid,
	"external_id" text,
	"direction" "sync_direction" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"call_outcome" "call_outcome",
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_sync_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "prospect_contacts" ADD CONSTRAINT "prospect_contacts_account_id_prospect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."prospect_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_signals" ADD CONSTRAINT "prospect_signals_account_id_prospect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."prospect_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_signals" ADD CONSTRAINT "prospect_signals_contact_id_prospect_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."prospect_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_signals" ADD CONSTRAINT "prospect_signals_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closer_scores" ADD CONSTRAINT "closer_scores_account_id_prospect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."prospect_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closer_briefs" ADD CONSTRAINT "closer_briefs_account_id_prospect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."prospect_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closer_briefs" ADD CONSTRAINT "closer_briefs_score_id_closer_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."closer_scores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_account_id_prospect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."prospect_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_contact_id_prospect_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."prospect_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_brief_id_closer_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."closer_briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sync_events" ADD CONSTRAINT "vendor_sync_events_account_id_prospect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."prospect_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sync_events" ADD CONSTRAINT "vendor_sync_events_contact_id_prospect_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."prospect_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sync_events" ADD CONSTRAINT "vendor_sync_events_draft_id_outreach_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."outreach_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_accounts_status_idx" ON "prospect_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospect_contacts_account_idx" ON "prospect_contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "scrape_runs_status_idx" ON "scrape_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospect_signals_account_idx" ON "prospect_signals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "prospect_signals_type_idx" ON "prospect_signals" USING btree ("type");--> statement-breakpoint
CREATE INDEX "closer_scores_account_idx" ON "closer_scores" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "closer_scores_signals_hash_idx" ON "closer_scores" USING btree ("account_id","signals_hash");--> statement-breakpoint
CREATE INDEX "closer_briefs_account_idx" ON "closer_briefs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "outreach_drafts_status_idx" ON "outreach_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_drafts_account_idx" ON "outreach_drafts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "compliance_logs_entity_idx" ON "compliance_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "compliance_logs_action_idx" ON "compliance_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "vendor_sync_events_vendor_idx" ON "vendor_sync_events" USING btree ("vendor");--> statement-breakpoint
CREATE INDEX "vendor_sync_events_outcome_idx" ON "vendor_sync_events" USING btree ("call_outcome");--> statement-breakpoint
CREATE INDEX "vendor_sync_events_account_idx" ON "vendor_sync_events" USING btree ("account_id");