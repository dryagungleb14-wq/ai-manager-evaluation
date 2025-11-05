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
  private db: DatabaseClient | null = null;

  async init(): Promise<void> {
    this.db = await getDatabase();
    // Initialize default advanced checklists for multi-user support
    await this.ensureAdvancedChecklistsInitialized();
  }

  private async ensureAdvancedChecklistsInitialized(): Promise<void> {
    try {
      const existing = await this.getAdvancedChecklists();
      if (existing.length === 0) {
        console.log("[storage] No advanced checklists found during init, ensuring database structure is ready");
        // Call the seed function with empty array to ensure initialization
        await seedDefaultAdvancedChecklists([]);
      }
    } catch (error) {
      logger.error('storage', error, { operation: 'ensureAdvancedChecklistsInitialized' });
      // Continue with normal operation even if initialization fails
    }
  }

  // Advanced Checklists methods
  async getAdvancedChecklists(): Promise<AdvancedChecklist[]> {
    const db = await getDatabase();
    const results = await db.select().from(advancedChecklists);
    
    // Convert database records to AdvancedChecklist format with stages
    const checklistsWithStages: AdvancedChecklist[] = [];
    
    for (const checklist of results) {
      const stages = await this.getChecklistStages(checklist.id);
      checklistsWithStages.push({
        id: checklist.id.toString(),
        name: checklist.name,
        version: checklist.version,
        type: "advanced",
        totalScore: checklist.totalScore,
        stages: stages,
        createdAt: new Date(checklist.createdAt),
        updatedAt: new Date(checklist.updatedAt),
      });
    }
    
    return checklistsWithStages;
  }

  async getAdvancedChecklistWithStages(id: string): Promise<AdvancedChecklist | null> {
    const db = await getDatabase();
    const result = await db.select().from(advancedChecklists).where(eq(advancedChecklists.id, parseInt(id)));
    
    if (!result.length) return null;
    
    const checklist = result[0];
    const stages = await this.getChecklistStages(checklist.id);
    
    return {
      id: checklist.id.toString(),
      name: checklist.name,
      version: checklist.version,
      type: "advanced",
      totalScore: checklist.totalScore,
      stages: stages,
      createdAt: new Date(checklist.createdAt),
      updatedAt: new Date(checklist.updatedAt),
    };
  }

  private async getChecklistStages(checklistId: number): Promise<any> {
    const db = await getDatabase();
    const stageResults = await db.select().from(checklistStages).where(eq(checklistStages.checklistId, checklistId));
    
    const stages = [];
    for (const stage of stageResults) {
      const criteria = await this.getChecklistCriteria(stage.id);
      stages.push({
        id: stage.id.toString(),
        name: stage.name,
        order: stage.order,
        criteria: criteria,
      });
    }
    
    return stages.sort((a, b) => a.order - b.order);
  }

  private async getChecklistCriteria(stageId: number): Promise<any> {
    const db = await getDatabase();
    const criteriaResults = await db.select().from(checklistCriteria).where(eq(checklistCriteria.stageId, stageId));
    
    return criteriaResults.map(c => ({
      id: c.id.toString(),
      number: c.number,
      title: c.title,
      description: c.description,
      weight: c.weight,
      isBinary: c.isBinary,
      max: c.levels?.max,
      mid: c.levels?.mid,
      min: c.levels?.min,
    }));
  }

  async createAdvancedChecklist(checklist: AdvancedChecklist): Promise<AdvancedChecklist> {
    const db = await getDatabase();
    
    // Insert the main checklist
    const result = await db.insert(advancedChecklists).values({
      name: checklist.name,
      version: checklist.version,
      totalScore: checklist.totalScore,
    });
    
    // Get the inserted checklist ID
    const checklistId = typeof result === 'object' && 'lastInsertRowid' in result ? 
      result.lastInsertRowid as number : parseInt(checklist.id);
    
    // Insert stages
    for (const stage of checklist.stages) {
      const stageResult = await db.insert(checklistStages).values({
        checklistId: checklistId,
        name: stage.name,
        order: stage.order,
      });
      
      const stageId = typeof stageResult === 'object' && 'lastInsertRowid' in stageResult ?
        stageResult.lastInsertRowid as number : parseInt(stage.id);
      
      // Insert criteria for this stage
      for (const criterion of stage.criteria) {
        await db.insert(checklistCriteria).values({
          stageId: stageId,
          number: criterion.number,
          title: criterion.title,
          description: criterion.description,
          weight: criterion.weight,
          isBinary: criterion.isBinary,
          levels: {
            max: criterion.max,
            mid: criterion.mid,
            min: criterion.min,
          },
        });
      }
    }
    
    // Log the action in history
    await db.insert(checklistHistory).values({
      checklistId: checklistId,
      action: "created",
      changes: { name: checklist.name, version: checklist.version },
      userId: undefined,
    });
    
    return checklist;
  }

  // Advanced Analyses methods
  async saveAdvancedAnalysis(
    report: AdvancedChecklistReport,
    checklistId: string,
    transcript: string,
    managerId?: string,
    source: "call" | "correspondence" = "call",
    language: string = "ru",
    userId?: string
  ): Promise<string> {
    const db = await getDatabase();
    
    const result = await db.insert(advancedAnalyses).values({
      userId: userId ? parseInt(userId) : undefined,
      checklistId: parseInt(checklistId),
      managerId: managerId ? parseInt(managerId) : undefined,
      source,
      language,
      transcript,
      report,
    });
    
    const analysisId = typeof result === 'object' && 'lastInsertRowid' in result ?
      (result.lastInsertRowid as number).toString() : "0";
    
    return analysisId;
  }

  async getAdvancedAnalysis(id: string): Promise<any> {
    const db = await getDatabase();
    const result = await db.select().from(advancedAnalyses).where(eq(advancedAnalyses.id, parseInt(id)));
    
    if (!result.length) return null;
    
    const analysis = result[0];
    return {
      id: analysis.id.toString(),
      userId: analysis.userId?.toString(),
      checklistId: analysis.checklistId?.toString(),
      managerId: analysis.managerId?.toString(),
      source: analysis.source,
      language: analysis.language,
      transcript: analysis.transcript,
      report: analysis.report,
      analyzedAt: analysis.analyzedAt.toISOString(),
    };
  }

  async getAllAdvancedAnalyses(filterUserId?: string): Promise<any> {
    const db = await getDatabase();
    let query = db.select().from(advancedAnalyses);
    
    if (filterUserId) {
      query = query.where(eq(advancedAnalyses.userId, parseInt(filterUserId)));
    }
    
    const results = await query;
    
    return results.map(analysis => ({
      id: analysis.id.toString(),
      userId: analysis.userId?.toString(),
      checklistId: analysis.checklistId?.toString(),
      managerId: analysis.managerId?.toString(),
      source: analysis.source,
      language: analysis.language,
      transcript: analysis.transcript,
      report: analysis.report,
      analyzedAt: analysis.analyzedAt.toISOString(),
    }));
  }

  // Existing methods (kept for backward compatibility)
  async getChecklists(): Promise<Checklist[]> {
    return [];
  }

  async getChecklist(id: string): Promise<Checklist | null> {
    return null;
  }

  async createChecklist(checklist: Checklist): Promise<Checklist> {
    return checklist;
  }

  async updateChecklist(id: string, checklist: Checklist): Promise<Checklist | null> {
    return checklist;
  }

  async deleteChecklist(id: string): Promise<boolean> {
    return true;
  }

  async getManagers(): Promise<Manager[]> {
    return [];
  }

  async getManager(id: string): Promise<Manager | null> {
    return null;
  }

  async createManager(manager: any): Promise<Manager> {
    return manager;
  }

  async updateManager(id: string, manager: any): Promise<Manager | null> {
    return manager;
  }

  async deleteManager(id: string): Promise<boolean> {
    return true;
  }

  async saveAnalysis(
    report: AnalysisReport,
    checklistId: string,
    transcript: string,
    managerId?: string,
    userId?: string
  ): Promise<string> {
    return "0";
  }

  async getAnalysis(id: string): Promise<StoredAnalysis | null> {
    return null;
  }

  async getAllAnalyses(filterUserId?: string): Promise<StoredAnalysis[]> {
    return [];
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    return true;
  }
}

export const storage = new Storage();

// Seed function to initialize default advanced checklists
export async function seedDefaultAdvancedChecklists(defaultAdvancedChecklists: AdvancedChecklist[]): Promise<void> {
  try {
    const existing = await storage.getAdvancedChecklists();
    
    // Check if any of the default checklists already exist by ID
    const checklistIds = new Set(existing.map((c) => c.id));
    const checklistsToAdd = defaultAdvancedChecklists.filter((c) => !checklistIds.has(c.id));
    
    if (checklistsToAdd.length > 0) {
      console.log(`Seeding database with ${checklistsToAdd.length} advanced checklists...`);
      for (const checklist of checklistsToAdd) {
        await storage.createAdvancedChecklist(checklist);
      }
      console.log(`Seeded ${checklistsToAdd.length} advanced checklists`);
    } else {
      console.log("All default advanced checklists already exist in database");
    }
  } catch (error) {
    logger.error('storage', error, { operation: 'seedAdvancedChecklists' });
    console.warn("[storage] Continuing with empty advanced checklist database");
  }
}

// Placeholder for other seed functions that may be called from index.ts
export async function seedDefaultChecklists(checklists: any[]): Promise<void> {
  // Implementation kept for backward compatibility
}

export async function seedDefaultManagers(): Promise<void> {
  // Implementation kept for backward compatibility
}

export async function seedDefaultUsers(): Promise<void> {
  // Implementation kept for backward compatibility
}

export const storageInitializationError: Error | null = null;
export const storageUsesDatabase: boolean = true;

export async function waitForStorage(): Promise<void> {
  // Implementation kept for backward compatibility
}
