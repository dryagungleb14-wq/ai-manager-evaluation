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
