// Integration: blueprint:javascript_database
import {
  Checklist,
  AnalysisReport,
  Manager,
  checklists,
  analyses,
  managers,
  users,
  AdvancedChecklist,
  AdvancedChecklistReport,
  advancedChecklists,
  checklistStages,
  checklistCriteria,
  checklistHistory,
  advancedAnalyses,
} from "./shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { getDatabase, type DatabaseClient } from "./db.js";
import { logger } from "./utils/logger.js";
import { forUlyanaChecklist } from './data/for-ulyana-checklist';
import { preTrialChecklist } from './data/pre-trial-checklist';

export interface StoredAnalysis {
  id: string;
  source: "call" | "correspondence";
  language: string;
  transcript: string;
  checklistReport: any;
  objectionsReport: any;
  analyzedAt: string;
  managerId?: string | null;
}

class Storage {
  private db: DatabaseClient;

  constructor() {
    this.db = getDatabase();
  }

  // Analysis methods
  async createAnalysis(analysis: any): Promise<void> {
    try {
      await this.db.insert(analyses).values({
        id: analysis.id,
        source: analysis.source,
        language: analysis.language,
        transcript: analysis.transcript,
        checklistReport: JSON.stringify(analysis.checklistReport),
        objectionsReport: JSON.stringify(analysis.objectionsReport),
        analyzedAt: analysis.analyzedAt,
        managerId: analysis.managerId,
      });
    } catch (error) {
      logger.error('storage', error, { operation: 'createAnalysis', analysis });
      throw error;
    }
  }

  async getAnalyses(managerId?: string): Promise<StoredAnalysis[]> {
    try {
      let query = this.db.select().from(analyses);
      if (managerId) {
        query = query.where(eq(analyses.managerId, managerId));
      }
      const results = await query.orderBy(desc(analyses.analyzedAt));
      return results as StoredAnalysis[];
    } catch (error) {
      logger.error('storage', error, { operation: 'getAnalyses' });
      throw error;
    }
  }

  // Checklist methods
  async createChecklist(checklist: Checklist): Promise<void> {
    try {
      await this.db.insert(checklists).values(checklist);
    } catch (error) {
      logger.error('storage', error, { operation: 'createChecklist', checklist });
      throw error;
    }
  }

  async getChecklists(): Promise<Checklist[]> {
    try {
      return await this.db.select().from(checklists);
    } catch (error) {
      logger.error('storage', error, { operation: 'getChecklists' });
      throw error;
    }
  }

  async updateChecklist(id: string, updates: Partial<Checklist>): Promise<void> {
    try {
      await this.db.update(checklists).set(updates).where(eq(checklists.id, id));
    } catch (error) {
      logger.error('storage', error, { operation: 'updateChecklist', id });
      throw error;
    }
  }

  async deleteChecklist(id: string): Promise<void> {
    try {
      await this.db.delete(checklists).where(eq(checklists.id, id));
    } catch (error) {
      logger.error('storage', error, { operation: 'deleteChecklist', id });
      throw error;
    }
  }

  // Advanced Checklist methods
  async createAdvancedChecklist(checklist: AdvancedChecklist): Promise<void> {
    try {
      await this.db.insert(advancedChecklists).values(checklist);
    } catch (error) {
      logger.error('storage', error, { operation: 'createAdvancedChecklist', checklist });
      throw error;
    }
  }

  async getAdvancedChecklists(): Promise<AdvancedChecklist[]> {
    try {
      return await this.db.select().from(advancedChecklists);
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedChecklists' });
      throw error;
    }
  }

  async getAdvancedChecklistById(id: string): Promise<AdvancedChecklist | null> {
    try {
      const result = await this.db
        .select()
        .from(advancedChecklists)
        .where(eq(advancedChecklists.id, id));
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedChecklistById', id });
      throw error;
    }
  }

  async updateAdvancedChecklist(id: string, updates: Partial<AdvancedChecklist>): Promise<void> {
    try {
      await this.db
        .update(advancedChecklists)
        .set(updates)
        .where(eq(advancedChecklists.id, id));
    } catch (error) {
      logger.error('storage', error, { operation: 'updateAdvancedChecklist', id });
      throw error;
    }
  }

  async deleteAdvancedChecklist(id: string): Promise<void> {
    try {
      await this.db.delete(advancedChecklists).where(eq(advancedChecklists.id, id));
    } catch (error) {
      logger.error('storage', error, { operation: 'deleteAdvancedChecklist', id });
      throw error;
    }
  }

  // Advanced Checklist Report methods
  async createAdvancedChecklistReport(
    report: AdvancedChecklistReport
  ): Promise<void> {
    try {
      await this.db
        .insert(advancedAnalyses)
        .values({
          ...report,
          results: JSON.stringify(report.results),
          metadata: JSON.stringify(report.metadata),
        } as any);
    } catch (error) {
      logger.error('storage', error, { operation: 'createAdvancedChecklistReport' });
      throw error;
    }
  }

  async getAdvancedChecklistReports(
    checklistId: string
  ): Promise<AdvancedChecklistReport[]> {
    try {
      return await this.db
        .select()
        .from(advancedAnalyses)
        .where(eq(advancedAnalyses.checklistId, checklistId))
        .orderBy(desc(advancedAnalyses.createdAt));
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedChecklistReports' });
      throw error;
    }
  }

  // Manager methods
  async createManager(manager: Manager): Promise<void> {
    try {
      await this.db.insert(managers).values(manager);
    } catch (error) {
      logger.error('storage', error, { operation: 'createManager', manager });
      throw error;
    }
  }

  async getManagers(): Promise<Manager[]> {
    try {
      return await this.db.select().from(managers);
    } catch (error) {
      logger.error('storage', error, { operation: 'getManagers' });
      throw error;
    }
  }

  async getManagerById(id: string): Promise<Manager | null> {
    try {
      const result = await this.db
        .select()
        .from(managers)
        .where(eq(managers.id, id));
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('storage', error, { operation: 'getManagerById', id });
      throw error;
    }
  }

  async updateManager(id: string, updates: Partial<Manager>): Promise<void> {
    try {
      await this.db.update(managers).set(updates).where(eq(managers.id, id));
    } catch (error) {
      logger.error('storage', error, { operation: 'updateManager', id });
      throw error;
    }
  }

  async deleteManager(id: string): Promise<void> {
    try {
      await this.db.delete(managers).where(eq(managers.id, id));
    } catch (error) {
      logger.error('storage', error, { operation: 'deleteManager', id });
      throw error;
    }
  }
}

export const storage = new Storage();

// Seed function to initialize default advanced checklists
export async function seedDefaultAdvancedChecklists(): Promise<void> {
  try {
    console.log('[storage] Starting to seed default advanced checklists...');
    const existing = await storage.getAdvancedChecklists();
    const checklistIds = new Set(existing.map((c) => c.id));
    
    // Сидируем оба чек-листа глобально (без userId/ownerId)
    const checklistsToAdd = [preTrialChecklist, forUlyanaChecklist].filter((c) => !checklistIds.has(c.id));
    
    if (checklistsToAdd.length > 0) {
      console.log(`[storage] Seeding database with ${checklistsToAdd.length} advanced checklists...`);
      for (const checklist of checklistsToAdd) {
        console.log(`[storage] Creating advanced checklist: ${checklist.id}`);
        await storage.createAdvancedChecklist(checklist);
      }
      console.log(`[storage] Successfully seeded ${checklistsToAdd.length} advanced checklists`);
    } else {
      console.log("[storage] All default advanced checklists already exist in database");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[storage] CRITICAL ERROR seeding advanced checklists: ${errorMessage}`);
    logger.error('storage', error, { operation: 'seedAdvancedChecklists' });
    // Re-throw the error so deployment fails and alerts the user
    throw new Error(`Failed to seed advanced checklists: ${errorMessage}`);
  }
}
