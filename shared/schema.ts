import { z } from "zod";
import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Типы чек-листов
export const checklistItemTypeSchema = z.enum(["mandatory", "recommended", "prohibited"]);
export type ChecklistItemType = z.infer<typeof checklistItemTypeSchema>;

export const checklistItemCriteriaSchema = z.object({
  positive_patterns: z.array(z.string()).optional(),
  negative_patterns: z.array(z.string()).optional(),
  llm_hint: z.string(),
});

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: checklistItemTypeSchema,
  criteria: checklistItemCriteriaSchema,
  confidence_threshold: z.number().min(0).max(1).default(0.6),
});

export const checklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default("1.0"),
  items: z.array(checklistItemSchema),
});

export type ChecklistItemCriteria = z.infer<typeof checklistItemCriteriaSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Checklist = z.infer<typeof checklistSchema>;

// Типы транскриптов
export const transcriptSegmentSchema = z.object({
  start: z.number().optional(),
  end: z.number().optional(),
  speaker: z.string().optional(),
  text: z.string(),
});

export const transcriptSchema = z.object({
  segments: z.array(transcriptSegmentSchema),
  language: z.string().default("ru"),
  duration: z.number().optional(),
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;

// Типы отчетов
export const checklistItemStatusSchema = z.enum(["passed", "failed", "uncertain"]);
export type ChecklistItemStatus = z.infer<typeof checklistItemStatusSchema>;

export const evidenceSchema = z.object({
  text: z.string(),
  start: z.number().optional(),
  end: z.number().optional(),
});

export const checklistReportItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: checklistItemTypeSchema,
  status: checklistItemStatusSchema,
  score: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
  comment: z.string().optional(),
});

export const checklistReportMetaSchema = z.object({
  source: z.enum(["call", "correspondence"]),
  language: z.string(),
  analyzed_at: z.string(),
  duration: z.number().optional(),
  volume: z.number().optional(),
});

export const checklistReportSchema = z.object({
  meta: checklistReportMetaSchema,
  items: z.array(checklistReportItemSchema),
  summary: z.string(),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type ChecklistReportItem = z.infer<typeof checklistReportItemSchema>;
export type ChecklistReportMeta = z.infer<typeof checklistReportMetaSchema>;
export type ChecklistReport = z.infer<typeof checklistReportSchema>;

// Типы возражений
export const objectionHandlingSchema = z.enum(["handled", "partial", "unhandled"]);
export type ObjectionHandling = z.infer<typeof objectionHandlingSchema>;

export const objectionSchema = z.object({
  category: z.string(),
  client_phrase: z.string(),
  manager_reply: z.string().optional(),
  handling: objectionHandlingSchema,
  advice: z.string().optional(),
});

export const objectionsReportSchema = z.object({
  topics: z.array(z.string()),
  objections: z.array(objectionSchema),
  conversation_essence: z.string(),
  outcome: z.string(),
});

export type Objection = z.infer<typeof objectionSchema>;
export type ObjectionsReport = z.infer<typeof objectionsReportSchema>;

// Комбинированный отчет
export const analysisReportSchema = z.object({
  checklistReport: checklistReportSchema,
  objectionsReport: objectionsReportSchema,
});

export type AnalysisReport = z.infer<typeof analysisReportSchema>;

// API типы
export const transcribeRequestSchema = z.object({
  language: z.string().optional(),
});

export const transcribeResponseSchema = z.object({
  transcript: transcriptSchema,
  language: z.string(),
});

export const analyzeRequestSchema = z.object({
  transcript: z.string().or(transcriptSchema),
  checklist: checklistSchema,
  language: z.string().optional(),
  managerId: z.string().optional(),
});

export const analyzeResponseSchema = analysisReportSchema;

export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

// Insert schemas для создания новых записей
export const insertChecklistSchema = checklistSchema.omit({ id: true });
export const insertChecklistItemSchema = checklistItemSchema.omit({ id: true });

export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;

// Drizzle Tables for PostgreSQL
export const managers = pgTable("managers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  teamLead: text("team_lead"),
  department: text("department"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const checklists = pgTable("checklists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull().default("1.0"),
  items: jsonb("items").$type<ChecklistItem[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").references(() => checklists.id),
  managerId: integer("manager_id").references(() => managers.id),
  source: text("source", { enum: ["call", "correspondence"] }).notNull(),
  language: text("language").notNull().default("ru"),
  transcript: text("transcript").notNull(),
  checklistReport: jsonb("checklist_report").$type<ChecklistReport>().notNull(),
  objectionsReport: jsonb("objections_report").$type<ObjectionsReport>().notNull(),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});

// Drizzle-Zod schemas for inserts
export const insertManagerDbSchema = createInsertSchema(managers).omit({ 
  id: true,
  createdAt: true, 
  updatedAt: true 
});

export const insertChecklistDbSchema = createInsertSchema(checklists).omit({ 
  id: true,
  createdAt: true, 
  updatedAt: true 
});

export const insertAnalysisDbSchema = createInsertSchema(analyses).omit({ 
  id: true,
  analyzedAt: true 
});

// Types from Drizzle tables
export type Manager = typeof managers.$inferSelect;
export type InsertManager = z.infer<typeof insertManagerDbSchema>;
export type DbChecklist = typeof checklists.$inferSelect;
export type InsertDbChecklist = z.infer<typeof insertChecklistDbSchema>;
export type DbAnalysis = typeof analyses.$inferSelect;
export type InsertDbAnalysis = z.infer<typeof insertAnalysisDbSchema>;
