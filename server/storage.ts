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
  // ... остальные методы класса ...
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
