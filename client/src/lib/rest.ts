import { z } from "zod";

export const checklistItemTypeSchema = z.enum([
  "mandatory",
  "recommended",
  "prohibited",
]);
export type ChecklistItemType = z.infer<typeof checklistItemTypeSchema>;

export const checklistItemCriteriaSchema = z.object({
  positive_patterns: z.array(z.string()).optional(),
  negative_patterns: z.array(z.string()).optional(),
  llm_hint: z.string(),
});
export type ChecklistItemCriteria = z.infer<typeof checklistItemCriteriaSchema>;

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: checklistItemTypeSchema,
  criteria: checklistItemCriteriaSchema,
  confidence_threshold: z.number().min(0).max(1).default(0.6),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default("1.0"),
  items: z.array(checklistItemSchema),
  type: z.enum(["simple", "advanced"]).optional(),
});
export type Checklist = z.infer<typeof checklistSchema>;

export const insertChecklistSchema = checklistSchema.omit({ id: true });
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;

export const checklistItemStatusSchema = z.enum([
  "passed",
  "failed",
  "uncertain",
]);
export type ChecklistItemStatus = z.infer<typeof checklistItemStatusSchema>;

export const evidenceSchema = z.object({
  text: z.string(),
  start: z.number().optional(),
  end: z.number().optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const checklistReportItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: checklistItemTypeSchema,
  status: checklistItemStatusSchema,
  score: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
  comment: z.string().optional(),
});
export type ChecklistReportItem = z.infer<typeof checklistReportItemSchema>;

export const checklistReportMetaSchema = z.object({
  source: z.enum(["call", "correspondence"]),
  language: z.string(),
  analyzed_at: z.string(),
  duration: z.number().optional(),
  volume: z.number().optional(),
});
export type ChecklistReportMeta = z.infer<typeof checklistReportMetaSchema>;

export const checklistReportSchema = z.object({
  meta: checklistReportMetaSchema,
  items: z.array(checklistReportItemSchema),
  summary: z.string(),
});
export type ChecklistReport = z.infer<typeof checklistReportSchema>;

export const objectionHandlingSchema = z.enum([
  "handled",
  "partial",
  "unhandled",
]);
export type ObjectionHandling = z.infer<typeof objectionHandlingSchema>;

export const objectionSchema = z.object({
  category: z.string(),
  client_phrase: z.string(),
  manager_reply: z.string().optional(),
  handling: objectionHandlingSchema,
  advice: z.string().optional(),
});
export type Objection = z.infer<typeof objectionSchema>;

export const objectionsReportSchema = z.object({
  topics: z.array(z.string()),
  objections: z.array(objectionSchema),
  conversation_essence: z.string(),
  outcome: z.string(),
});
export type ObjectionsReport = z.infer<typeof objectionsReportSchema>;

export const analysisReportSchema = z.object({
  checklistReport: checklistReportSchema,
  objectionsReport: objectionsReportSchema,
});
export type AnalysisReport = z.infer<typeof analysisReportSchema>;

const nullableString = z.string().nullable();

export const managerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: nullableString,
  email: nullableString,
  teamLead: nullableString,
  department: nullableString,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Manager = z.infer<typeof managerSchema>;

export const insertManagerSchema = managerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertManager = z.infer<typeof insertManagerSchema>;

// ============================================
// Advanced Checklist Types
// ============================================

export const criterionLevelSchema = z.object({
  description: z.string(),
  score: z.number(),
});
export type CriterionLevel = z.infer<typeof criterionLevelSchema>;

export const checklistCriterionSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  description: z.string(),
  weight: z.number(),
  max: criterionLevelSchema.optional(),
  mid: criterionLevelSchema.optional(),
  min: criterionLevelSchema.optional(),
  isBinary: z.boolean().optional(),
});
export type ChecklistCriterion = z.infer<typeof checklistCriterionSchema>;

export const checklistStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  criteria: z.array(checklistCriterionSchema),
});
export type ChecklistStage = z.infer<typeof checklistStageSchema>;

export const advancedChecklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  type: z.literal("advanced"),
  totalScore: z.number(),
  stages: z.array(checklistStageSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type AdvancedChecklist = z.infer<typeof advancedChecklistSchema>;

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

export const stageReportSchema = z.object({
  stageName: z.string(),
  criteria: z.array(criterionReportSchema),
});
export type StageReport = z.infer<typeof stageReportSchema>;

export const advancedChecklistReportSchema = z.object({
  checklistId: z.string(),
  totalScore: z.number(),
  maxPossibleScore: z.number(),
  percentage: z.number(),
  stages: z.array(stageReportSchema),
  summary: z.string(),
});
export type AdvancedChecklistReport = z.infer<typeof advancedChecklistReportSchema>;

