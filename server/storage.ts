// Integration: blueprint:javascript_database
import
 {
  Checklist,
  AnalysisReport,
  Manager,
  InsertManager,
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
}
 from
 "./shared/schema.js";
import
 {
  eq, desc
 }
 from
 "drizzle-orm";
import
 {
  getDatabase, type
  DatabaseClient
 }
 from
 "./db.js";
import
 {
  logger
 }
 from
 "./utils/logger.js";
import
 {
  forUlyanaChecklist
 }
 from
 './data/for-ulyana-checklist.js';
import
 {
  preTrialChecklist
 }
 from
 './data/pre-trial-checklist.js';

// Helper function to safely parse checklist items
function parseChecklistItems(item: any): any {
  if (typeof item === 'object' && item !== null) {
    return item;
  }
  if (typeof item === 'string') {
    return JSON.parse(item);
  }
  return item;
}

export
 interface
 StoredAnalysis
 {
  id: string;
  source: "call" | "correspondence";
  language: string;
  transcript: string;
  checklistReport: any;
  objectionsReport: any;
  analyzedAt: string;
  managerId?: string | null;
}
class
 Storage
 {
  private
   dbPromise: Promise<DatabaseClient>;
  constructor()
 {
    this.dbPromise = getDatabase();
  }
  private
   async
   getDb(): Promise<DatabaseClient> 
 {
    return this.dbPromise;
  }
  // Analysis methods (simple checklists)
  async
   createAnalysis(analysis: any): Promise<void> 
 {
    try
     {
      const db = await this.getDb();
      await db.insert(analyses).values({
        id: analysis.id,
        source: analysis.source,
        language: analysis.language,
        transcript: analysis.transcript,
        checklistReport: JSON.stringify(analysis.checklistReport),
        objectionsReport: JSON.stringify(analysis.objectionsReport),
        analyzedAt: analysis.analyzedAt,
        managerId: analysis.managerId,
      });
    }
     catch (error)
     {
      logger.error('storage', error, {
         operation: 'createAnalysis', analysis
         });
      throw error;
    }
  }
  async
   getAnalyses(managerId?: string): Promise<StoredAnalysis[]> 
 {
    try
     {
      const db = await this.getDb();
      let query = db.select().from(analyses);
      if (managerId)
       {
        query = query.where(eq(analyses.managerId, parseInt(managerId)));
      }
      const results = await query.orderBy(desc(analyses.analyzedAt));
