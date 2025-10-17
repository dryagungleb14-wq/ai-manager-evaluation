// Integration: blueprint:javascript_database
import { Checklist, AnalysisReport, checklists, analyses } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Checklists
  getChecklists(): Promise<Checklist[]>;
  getChecklist(id: string): Promise<Checklist | undefined>;
  createChecklist(checklist: Checklist): Promise<Checklist>;
  updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined>;
  deleteChecklist(id: string): Promise<boolean>;
  
  // Analysis history
  saveAnalysis(analysis: AnalysisReport, checklistId?: string, transcript?: string): Promise<string>;
  getAnalysis(id: string): Promise<AnalysisReport | undefined>;
  getAllAnalyses(): Promise<AnalysisReport[]>;
}

export class DatabaseStorage implements IStorage {
  async getChecklists(): Promise<Checklist[]> {
    const dbChecklists = await db.select().from(checklists);
    
    return dbChecklists.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      version: c.version,
      items: c.items,
    }));
  }

  async getChecklist(id: string): Promise<Checklist | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [checklist] = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, numId));

    if (!checklist) return undefined;

    return {
      id: checklist.id.toString(),
      name: checklist.name,
      version: checklist.version,
      items: checklist.items,
    };
  }

  async createChecklist(checklist: Checklist): Promise<Checklist> {
    const [created] = await db
      .insert(checklists)
      .values({
        name: checklist.name,
        version: checklist.version,
        items: checklist.items,
      })
      .returning();

    return {
      id: created.id.toString(),
      name: created.name,
      version: created.version,
      items: created.items,
    };
  }

  async updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [updated] = await db
      .update(checklists)
      .set({
        name: checklist.name,
        version: checklist.version,
        items: checklist.items,
        updatedAt: new Date(),
      })
      .where(eq(checklists.id, numId))
      .returning();

    if (!updated) return undefined;

    return {
      id: updated.id.toString(),
      name: updated.name,
      version: updated.version,
      items: updated.items,
    };
  }

  async deleteChecklist(id: string): Promise<boolean> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return false;

    const result = await db
      .delete(checklists)
      .where(eq(checklists.id, numId))
      .returning();

    return result.length > 0;
  }

  async saveAnalysis(
    analysis: AnalysisReport, 
    checklistId?: string,
    transcript?: string
  ): Promise<string> {
    // Only use checklistId if it's a valid numeric ID
    let numericChecklistId: number | null = null;
    if (checklistId) {
      const parsed = parseInt(checklistId, 10);
      if (!isNaN(parsed)) {
        numericChecklistId = parsed;
      }
    }

    const [saved] = await db
      .insert(analyses)
      .values({
        checklistId: numericChecklistId,
        source: analysis.checklistReport.meta.source,
        language: analysis.checklistReport.meta.language,
        transcript: transcript || "",
        checklistReport: analysis.checklistReport,
        objectionsReport: analysis.objectionsReport,
      })
      .returning();

    return saved.id.toString();
  }

  async getAnalysis(id: string): Promise<AnalysisReport | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, numId));

    if (!analysis) return undefined;

    return {
      checklistReport: analysis.checklistReport,
      objectionsReport: analysis.objectionsReport,
    };
  }

  async getAllAnalyses(): Promise<AnalysisReport[]> {
    const allAnalyses = await db
      .select()
      .from(analyses)
      .orderBy(analyses.analyzedAt);

    return allAnalyses.map((a) => ({
      checklistReport: a.checklistReport,
      objectionsReport: a.objectionsReport,
    }));
  }
}

export const storage = new DatabaseStorage();
