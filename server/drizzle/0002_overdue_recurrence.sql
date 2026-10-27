CREATE TYPE "public"."recurrence" AS ENUM('none', 'daily', 'weekly');--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'task_overdue';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence" "recurrence" DEFAULT 'none' NOT NULL;