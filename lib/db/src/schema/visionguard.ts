import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const videosTable = pgTable("visionguard_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  camera: text("camera").notNull(),
  location: text("location").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  resolution: text("resolution").notNull().default("Pending analysis"),
  status: varchar("status", { length: 24 }).notNull().default("processing"),
  peopleCount: integer("people_count").notNull().default(0),
  eventCount: integer("event_count").notNull().default(0),
  alertCount: integer("alert_count").notNull().default(0),
  riskLevel: varchar("risk_level", { length: 24 }).notNull().default("low"),
  summary: text("summary").notNull().default("Uploaded; AI analysis has not run."),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  source: varchar("source", { length: 24 }).notNull().default("upload"),
  objectPath: text("object_path"),
});

export const eventsTable = pgTable("visionguard_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  videoId: varchar("video_id")
    .notNull()
    .references(() => videosTable.id, { onDelete: "cascade" }),
  videoName: text("video_name").notNull(),
  timestampSeconds: integer("timestamp_seconds").notNull(),
  eventType: text("event_type").notNull(),
  severity: varchar("severity", { length: 24 }).notNull(),
  confidence: real("confidence").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  reviewStatus: varchar("review_status", { length: 24 })
    .notNull()
    .default("needs_review"),
  evidenceLabel: text("evidence_label").notNull(),
});

export const investigationsTable = pgTable("visionguard_investigations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  severity: varchar("severity", { length: 24 }).notNull().default("medium"),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  eventIds: jsonb("event_ids").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
});

export const alertsTable = pgTable("visionguard_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  severity: varchar("severity", { length: 24 }).notNull().default("medium"),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reportsTable = pgTable("visionguard_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  videoId: varchar("video_id")
    .notNull()
    .references(() => videosTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  severity: varchar("severity", { length: 24 }).notNull(),
  summary: text("summary").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("ready"),
});
