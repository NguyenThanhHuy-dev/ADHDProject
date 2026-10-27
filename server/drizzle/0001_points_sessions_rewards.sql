CREATE TYPE "public"."ledger_reason" AS ENUM('task_complete', 'session_complete', 'streak_bonus', 'gacha_spend');--> statement-breakpoint
CREATE TYPE "public"."rarity" AS ENUM('common', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" integer NOT NULL,
	"rarity" "rarity" NOT NULL,
	"obtained_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_once_per_ref" UNIQUE("user_id","reason","ref_id")
);
--> statement-breakpoint
CREATE TABLE "pomodoro_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"planned_minutes" integer NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"last_streak_date" date
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_user_idx" ON "inventory_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ledger_user_created_idx" ON "point_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_status_idx" ON "pomodoro_sessions" USING btree ("user_id","status","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_session_per_user" ON "pomodoro_sessions" USING btree ("user_id") WHERE "pomodoro_sessions"."status" = 'active';