import { z } from "zod";
import { pgTable, serial, integer, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
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
  managerId: z.string().nullable().optional(),
});

export const analyzeResponseSchema = analysisReportSchema;

export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

// Auth schemas for API
export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    role: z.enum(["admin", "user"]),
  }).optional(),
  message: z.string().optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// Manager schema for API
export const managerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  teamLead: z.string().nullable(),
  department: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Manager = z.infer<typeof managerSchema>;

// Insert schemas для создания новых записей
export const insertManagerSchema = managerSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const insertChecklistSchema = checklistSchema.omit({ id: true });
export const insertChecklistItemSchema = checklistItemSchema.omit({ id: true });

export type InsertManager = z.infer<typeof insertManagerSchema>;
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;

// Drizzle Tables for PostgreSQL

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Hashed password
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  source: text("source", { enum: ["call", "correspondence"] }).notNull(),
  language: text("language").notNull().default("ru"),
  text: text("text").notNull(),
  audioFileName: text("audio_file_name"),
  duration: integer("duration"), // Duration in seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  // Note: userId can be null for backward compatibility with existing data
  // For new deployments, consider adding .notNull() after initial migration
  userId: integer("user_id").references(() => users.id),
  checklistId: integer("checklist_id").references(() => checklists.id),
  managerId: integer("manager_id").references(() => managers.id),
  transcriptId: integer("transcript_id").references(() => transcripts.id),
  source: text("source", { enum: ["call", "correspondence"] }).notNull(),
  language: text("language").notNull().default("ru"),
  transcript: text("transcript").notNull(),
  checklistReport: jsonb("checklist_report").$type<ChecklistReport>().notNull(),
  objectionsReport: jsonb("objections_report").$type<ObjectionsReport>().notNull(),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});

// Drizzle-Zod schemas for inserts
export const insertUserDbSchema = createInsertSchema(users).omit({ 
  id: true,
  createdAt: true, 
  updatedAt: true 
});

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

export const insertTranscriptDbSchema = createInsertSchema(transcripts).omit({ 
  id: true,
  createdAt: true 
});

// Types from Drizzle tables
export type DbUser = typeof users.$inferSelect;
export type InsertDbUser = z.infer<typeof insertUserDbSchema>;
export type DbManager = typeof managers.$inferSelect;
export type InsertDbManager = z.infer<typeof insertManagerDbSchema>;
export type DbChecklist = typeof checklists.$inferSelect;
export type InsertDbChecklist = z.infer<typeof insertChecklistDbSchema>;
export type DbAnalysis = typeof analyses.$inferSelect;
export type InsertDbAnalysis = z.infer<typeof insertAnalysisDbSchema>;
export type DbTranscript = typeof transcripts.$inferSelect;
export type InsertDbTranscript = z.infer<typeof insertTranscriptDbSchema>;

// ============================================
// Advanced Checklist System (MAX/MID/MIN)
// ============================================

// Criterion level (MAX, MID, MIN)
export const criterionLevelSchema = z.object({
  description: z.string(),
  score: z.number(),
});

export type CriterionLevel = z.infer<typeof criterionLevelSchema>;

// Checklist criterion
export const checklistCriterionSchema = z.object({
  id: z.string(),
  number: z.string(), // "1.1", "2.1", etc.
  title: z.string(),
  description: z.string(),
  weight: z.number(),
  max: criterionLevelSchema.optional(),
  mid: criterionLevelSchema.optional(),
  min: criterionLevelSchema.optional(),
  isBinary: z.boolean().optional(),
});

export type ChecklistCriterion = z.infer<typeof checklistCriterionSchema>;

// Checklist stage
export const checklistStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  criteria: z.array(checklistCriterionSchema),
});

export type ChecklistStage = z.infer<typeof checklistStageSchema>;

// Advanced checklist
export const advancedChecklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  type: z.literal("advanced"),
  totalScore: z.number(),
  stages: z.array(checklistStageSchema),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type AdvancedChecklist = z.infer<typeof advancedChecklistSchema>;

// Criterion report (result for single criterion)
export const criterionReportSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  description: z.string().optional(),
  achievedLevel: z.enum(["max", "mid", "min"]).nullable(),
  score: z.number(),
  maxScore: z.number().optional(),
  evidence: z.array(z.object({
    text: z.string(),
    timestamp: z.string().optional(),
  })),
  comment: z.string(),
});

export type CriterionReport = z.infer<typeof criterionReportSchema>;

// Stage report
export const stageReportSchema = z.object({
  stageName: z.string(),
  criteria: z.array(criterionReportSchema),
});

export type StageReport = z.infer<typeof stageReportSchema>;

// Advanced checklist report
export const advancedChecklistReportSchema = z.object({
  checklistId: z.string(),
  totalScore: z.number(),
  maxPossibleScore: z.number(),
  percentage: z.number(),
  stages: z.array(stageReportSchema),
  summary: z.string(),
});

export type AdvancedChecklistReport = z.infer<typeof advancedChecklistReportSchema>;

// Database tables for advanced checklists
export const advancedChecklists = pgTable("advanced_checklists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  totalScore: integer("total_score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const checklistStages = pgTable("checklist_stages", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").references(() => advancedChecklists.id).notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
});

export const checklistCriteria = pgTable("checklist_criteria", {
  id: serial("id").primaryKey(),
  stageId: integer("stage_id").references(() => checklistStages.id).notNull(),
  number: text("number"),
  title: text("title").notNull(),
  description: text("description"),
  weight: integer("weight").notNull(),
  isBinary: boolean("is_binary").default(false),
  levels: jsonb("levels").$type<{
    max?: CriterionLevel;
    mid?: CriterionLevel;
    min?: CriterionLevel;
  }>(),
});

export const checklistHistory = pgTable("checklist_history", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").references(() => advancedChecklists.id).notNull(),
  action: text("action").notNull(), // "created", "updated", "deleted"
  changes: jsonb("changes"),
  userId: text("user_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const advancedAnalyses = pgTable("advanced_analyses", {
  id: serial("id").primaryKey(),
  // Note: userId can be null for backward compatibility with existing data
  // For new deployments, consider adding .notNull() after initial migration
  userId: integer("user_id").references(() => users.id),
  checklistId: integer("checklist_id").references(() => advancedChecklists.id),
  managerId: integer("manager_id").references(() => managers.id),
  transcriptId: integer("transcript_id").references(() => transcripts.id),
  source: text("source", { enum: ["call", "correspondence"] }).notNull(),
  language: text("language").notNull().default("ru"),
  transcript: text("transcript").notNull(),
  report: jsonb("report").$type<AdvancedChecklistReport>().notNull(),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});

// Drizzle-Zod schemas for inserts
export const insertAdvancedChecklistDbSchema = createInsertSchema(advancedChecklists).omit({ 
  id: true,
  createdAt: true, 
  updatedAt: true 
});

export const insertChecklistStageDbSchema = createInsertSchema(checklistStages).omit({ 
  id: true,
});

export const insertChecklistCriterionDbSchema = createInsertSchema(checklistCriteria).omit({ 
  id: true,
});

export const insertChecklistHistoryDbSchema = createInsertSchema(checklistHistory).omit({ 
  id: true,
  timestamp: true,
});

export const insertAdvancedAnalysisDbSchema = createInsertSchema(advancedAnalyses).omit({ 
  id: true,
  analyzedAt: true,
});

// Types from Drizzle tables
export type DbAdvancedChecklist = typeof advancedChecklists.$inferSelect;
export type InsertDbAdvancedChecklist = z.infer<typeof insertAdvancedChecklistDbSchema>;
export type DbChecklistStage = typeof checklistStages.$inferSelect;
export type InsertDbChecklistStage = z.infer<typeof insertChecklistStageDbSchema>;
export type DbChecklistCriterion = typeof checklistCriteria.$inferSelect;
export type InsertDbChecklistCriterion = z.infer<typeof insertChecklistCriterionDbSchema>;
export type DbChecklistHistory = typeof checklistHistory.$inferSelect;
export type InsertDbChecklistHistory = z.infer<typeof insertChecklistHistoryDbSchema>;
export type DbAdvancedAnalysis = typeof advancedAnalyses.$inferSelect;
export type InsertDbAdvancedAnalysis = z.infer<typeof insertAdvancedAnalysisDbSchema>;
