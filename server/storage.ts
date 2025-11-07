// Integration: blueprint:javascript_database
import {
  Checklist,
  AnalysisReport,
  Manager,
  InsertManager,
  checklists,
  analyses,
  managers,
  users,
  transcripts,
  AdvancedChecklist,
  AdvancedChecklistReport,
  advancedChecklists,
  checklistStages,
  checklistCriteria,
  checklistHistory,
  advancedAnalyses,
} from "./shared/schema.js";
import { eq, desc, inArray, and } from "drizzle-orm";
import { getDatabase, type DatabaseClient } from "./db.js";
import { logger } from "./utils/logger.js";
import { forUlyanaChecklist } from './data/for-ulyana-checklist.js';
import { preTrialChecklist } from './data/pre-trial-checklist.js';

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
  private dbPromise: Promise<DatabaseClient>;
  private static readonly MAX_LOG_VALUE_LENGTH = 100;
  private static readonly MAX_STORED_TRANSCRIPTS = 5;
  private static readonly MAX_STORED_ANALYSES = 5;

  constructor() {
    this.dbPromise = getDatabase();
  }

  // Public getter for the max stored analyses limit
  public static getMaxStoredAnalyses(): number {
    return Storage.MAX_STORED_ANALYSES;
  }

  private async getDb(): Promise<DatabaseClient> {
    return this.dbPromise;
  }

  private safeParse<T = any>(value: T | string): T {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        logger.error('storage', error, { 
          operation: 'safeParse', 
          value: value.substring(0, Storage.MAX_LOG_VALUE_LENGTH) 
        });
        throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return value as T;
  }

  // Analysis methods (simple checklists)
  async createAnalysis(analysis: any): Promise<void> {
    try {
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
    } catch (error) {
      logger.error('storage', error, { operation: 'createAnalysis', analysis });
      throw error;
    }
  }

  async getAnalyses(managerId?: string): Promise<StoredAnalysis[]> {
    try {
      const db = await this.getDb();
      let query = db.select().from(analyses);
      if (managerId) {
        query = query.where(eq(analyses.managerId, parseInt(managerId)));
      }
      const results = await query.orderBy(desc(analyses.analyzedAt));
      return results as StoredAnalysis[];
    } catch (error) {
      logger.error('storage', error, { operation: 'getAnalyses' });
      throw error;
    }
  }

  async saveAnalysis(
    result: any,
    checklistId: string,
    transcript: string,
    managerId?: string,
    userId?: string,
    transcriptId?: string
  ): Promise<string> {
    try {
      const db = await this.getDb();
      
      // First, clean up old analyses to keep only the last 5 per user
      if (userId) {
        await this.cleanupOldAnalyses(userId);
      }
      
      const analysis = {
        source: result.source || 'call',
        language: result.language || 'ru',
        transcript,
        checklistReport: result.checklistReport,
        objectionsReport: result.objectionsReport,
        analyzedAt: new Date(),
        managerId: managerId ? parseInt(managerId) : null,
        userId: userId ? parseInt(userId) : null,
        checklistId: parseInt(checklistId),
        transcriptId: transcriptId ? parseInt(transcriptId) : null,
      };

      const [inserted] = await db.insert(analyses).values(analysis as any).returning();
      return inserted.id.toString();
    } catch (error) {
      logger.error('storage', error, { operation: 'saveAnalysis' });
      throw error;
    }
  }

  async getAnalysis(id: string): Promise<any | null> {
    try {
      const db = await this.getDb();
      const [result] = await db
        .select()
        .from(analyses)
        .where(eq(analyses.id, parseInt(id)));
      
      if (!result) {
        return null;
      }

      return {
        ...result,
        checklistReport: this.safeParse(result.checklistReport),
        objectionsReport: this.safeParse(result.objectionsReport),
      };
    } catch (error) {
      logger.error('storage', error, { operation: 'getAnalysis', id });
      throw error;
    }
  }

  async getAllAnalyses(userId?: string): Promise<any[]> {
    try {
      const db = await this.getDb();
      let query = db.select().from(analyses);
      
      if (userId) {
        query = query.where(eq(analyses.userId, parseInt(userId)));
      }
      
      const results = await query.orderBy(desc(analyses.analyzedAt));
      
      return results.map((r: any) => ({
        ...r,
        checklistReport: this.safeParse(r.checklistReport),
        objectionsReport: this.safeParse(r.objectionsReport),
      }));
    } catch (error) {
      logger.error('storage', error, { operation: 'getAllAnalyses' });
      throw error;
    }
  }

  async getRecentAnalyses(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const db = await this.getDb();
      const results = await db
        .select()
        .from(analyses)
        .where(eq(analyses.userId, parseInt(userId)))
        .orderBy(desc(analyses.analyzedAt))
        .limit(limit);
      
      return results.map((r: any) => ({
        ...r,
        checklistReport: this.safeParse(r.checklistReport),
        objectionsReport: this.safeParse(r.objectionsReport),
      }));
    } catch (error) {
      logger.error('storage', error, { operation: 'getRecentAnalyses', userId });
      throw error;
    }
  }

  async cleanupOldAnalyses(userId: string): Promise<void> {
    try {
      const db = await this.getDb();
      const userAnalyses = await db
        .select()
        .from(analyses)
        .where(eq(analyses.userId, parseInt(userId)))
        .orderBy(desc(analyses.analyzedAt));

      // Keep only the last MAX_STORED_ANALYSES, delete the rest
      if (userAnalyses.length > Storage.MAX_STORED_ANALYSES) {
        const toDelete = userAnalyses
          .slice(Storage.MAX_STORED_ANALYSES)
          .map((a: any) => a.id);

        if (toDelete.length > 0) {
          await db.delete(analyses).where(inArray(analyses.id, toDelete));
          logger.info(
            'storage',
            `Cleaned up ${toDelete.length} old analyses for user ${userId}`
          );
        }
      }
    } catch (error) {
      logger.error('storage', error, { operation: 'cleanupOldAnalyses', userId });
      // Don't throw - cleanup failure shouldn't prevent analysis save
    }
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    try {
      const db = await this.getDb();
      await db.delete(analyses).where(eq(analyses.id, parseInt(id)));
      return true;
    } catch (error) {
      logger.error('storage', error, { operation: 'deleteAnalysis', id });
      throw error;
    }
  }

  // Transcript methods
  async saveTranscript(
    text: string,
    source: "call" | "correspondence",
    language: string,
    userId?: string,
    audioFileName?: string,
    duration?: number,
    audioHash?: string
  ): Promise<string> {
    try {
      const db = await this.getDb();
      
      // First, clean up old transcripts to keep only the last 5 per user
      if (userId) {
        await this.cleanupOldTranscripts(userId);
      }
      
      const transcript = {
        text,
        source,
        language,
        userId: userId ? parseInt(userId) : null,
        audioFileName: audioFileName || null,
        filename: audioFileName || null,  // Also populate filename field
        duration: duration || null,
        audioHash: audioHash || null,
      };

      const [inserted] = await db.insert(transcripts).values(transcript as any).returning();
      return inserted.id.toString();
    } catch (error) {
      logger.error('storage', error, { operation: 'saveTranscript' });
      throw error;
    }
  }

  async findTranscriptByHash(userId: string, audioHash: string): Promise<any | null> {
    try {
      const db = await this.getDb();
      const [existing] = await db
        .select()
        .from(transcripts)
        .where(
          and(
            eq(transcripts.userId, parseInt(userId)),
            eq(transcripts.audioHash, audioHash)
          )
        )
        .limit(1);

      return existing ?? null;
    } catch (error) {
      logger.error('storage', error, { operation: 'findTranscriptByHash', userId, audioHash });
      throw error;
    }
  }

  async cleanupOldTranscripts(userId: string): Promise<void> {
    try {
      const db = await this.getDb();
      const userTranscripts = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.userId, parseInt(userId)))
        .orderBy(desc(transcripts.createdAt));

      // Keep only the last MAX_STORED_TRANSCRIPTS, delete the rest
      if (userTranscripts.length > Storage.MAX_STORED_TRANSCRIPTS) {
        const toDelete = userTranscripts
          .slice(Storage.MAX_STORED_TRANSCRIPTS)
          .map((t: any) => t.id);

        if (toDelete.length > 0) {
          await db.delete(transcripts).where(inArray(transcripts.id, toDelete));
          logger.info(
            'storage',
            `Cleaned up ${toDelete.length} old transcripts for user ${userId}`
          );
        }
      }
    } catch (error) {
      logger.error('storage', error, { operation: 'cleanupOldTranscripts', userId });
      // Don't throw - cleanup failure shouldn't prevent transcript save
    }
  }

  async getRecentTranscripts(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const db = await this.getDb();
      const results = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.userId, parseInt(userId)))
        .orderBy(desc(transcripts.createdAt))
        .limit(limit);
      
      return results;
    } catch (error) {
      logger.error('storage', error, { operation: 'getRecentTranscripts', userId });
      throw error;
    }
  }

  async getTranscript(id: string): Promise<any | null> {
    try {
      const db = await this.getDb();
      const [result] = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.id, parseInt(id)));
      
      return result || null;
    } catch (error) {
      logger.error('storage', error, { operation: 'getTranscript', id });
      throw error;
    }
  }

  async updateTranscriptTimestamp(id: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db
        .update(transcripts)
        .set({ 
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(transcripts.id, parseInt(id)));
      logger.info('storage', `Updated timestamp for transcript ${id}`);
    } catch (error) {
      logger.error('storage', error, { operation: 'updateTranscriptTimestamp', id });
      // Don't throw - timestamp update failure shouldn't prevent transcript reuse
    }
  }

  // Checklist methods (simple checklists)
  async createChecklist(checklist: Checklist): Promise<Checklist> {
    try {
      const db = await this.getDb();
      const [inserted] = await db.insert(checklists).values({
        name: checklist.name,
        version: checklist.version,
        items: JSON.stringify(checklist.items),
      }).returning();
      
      return {
        id: inserted.id.toString(),
        name: inserted.name,
        version: inserted.version,
        items: this.safeParse(inserted.items),
      };
    } catch (error) {
      logger.error('storage', error, { operation: 'createChecklist', checklist });
      throw error;
    }
  }

  async getChecklists(): Promise<Checklist[]> {
    try {
      const db = await this.getDb();
      const results = await db.select().from(checklists);
      return results.map((r: any) => ({
        id: r.id.toString(),
        name: r.name,
        version: r.version,
        items: this.safeParse(r.items),
      }));
    } catch (error) {
      logger.error('storage', error, { operation: 'getChecklists' });
      throw error;
    }
  }

  async getChecklist(id: string): Promise<any | null> {
    try {
      const db = await this.getDb();
      const [result] = await db
        .select()
        .from(checklists)
        .where(eq(checklists.id, parseInt(id)));
      
      if (!result) {
        return null;
      }

      return {
        ...result,
        id: result.id.toString(),
        items: this.safeParse(result.items),
      };
    } catch (error) {
      logger.error('storage', error, { operation: 'getChecklist', id });
      throw error;
    }
  }

  async updateChecklist(id: string, updates: Partial<Checklist>): Promise<Checklist | null> {
    try {
      const db = await this.getDb();
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.version) updateData.version = updates.version;
      if (updates.items) updateData.items = JSON.stringify(updates.items);

      const [updated] = await db
        .update(checklists)
        .set(updateData)
        .where(eq(checklists.id, parseInt(id)))
        .returning();
      
      if (!updated) {
        return null;
      }

      return {
        id: updated.id.toString(),
        name: updated.name,
        version: updated.version,
        items: this.safeParse(updated.items),
      };
    } catch (error) {
      logger.error('storage', error, { operation: 'updateChecklist', id });
      throw error;
    }
  }

  async deleteChecklist(id: string): Promise<boolean> {
    try {
      const db = await this.getDb();
      await db.delete(checklists).where(eq(checklists.id, parseInt(id)));
      return true;
    } catch (error) {
      logger.error('storage', error, { operation: 'deleteChecklist', id });
      throw error;
    }
  }

  // Advanced Checklist methods
  async createAdvancedChecklist(checklist: AdvancedChecklist): Promise<AdvancedChecklist> {
    try {
      const db = await this.getDb();
      
      // Insert the main checklist record
      const [inserted] = await db.insert(advancedChecklists).values({
        name: checklist.name,
        version: checklist.version,
        totalScore: checklist.totalScore,
      }).returning();

      const checklistId = inserted.id;

      // Insert stages and criteria
      for (const stage of checklist.stages) {
        const [insertedStage] = await db.insert(checklistStages).values({
          checklistId,
          name: stage.name,
          order: stage.order,
        }).returning();

        const stageId = insertedStage.id;

        // Insert criteria for this stage
        for (const criterion of stage.criteria) {
          await db.insert(checklistCriteria).values({
            stageId,
            number: criterion.number,
            title: criterion.title,
            description: criterion.description,
            weight: criterion.weight,
            isBinary: criterion.isBinary || false,
            levels: criterion.max || criterion.mid || criterion.min ? {
              max: criterion.max,
              mid: criterion.mid,
              min: criterion.min,
            } : null,
          });
        }
      }

      // Return the full checklist with generated ID
      const fullChecklist = await this.getAdvancedChecklistWithStages(checklistId.toString());
      if (!fullChecklist) {
        throw new Error(`Failed to retrieve created checklist with ID ${checklistId}`);
      }
      return fullChecklist;
    } catch (error) {
      logger.error('storage', error, { operation: 'createAdvancedChecklist', checklist });
      throw error;
    }
  }

  async getAdvancedChecklists(): Promise<AdvancedChecklist[]> {
    try {
      const db = await this.getDb();
      const checklists = await db.select().from(advancedChecklists);
      
      // For each checklist, fetch its stages and criteria
      const results = await Promise.all(
        checklists.map(async (checklist: any) => {
          return this.getAdvancedChecklistWithStages(checklist.id.toString());
        })
      );
      
      // Filter out any null values (shouldn't happen, but TypeScript safety)
      return results.filter((c): c is AdvancedChecklist => c !== null);
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedChecklists' });
      throw error;
    }
  }

  async getAdvancedChecklistWithStages(id: string): Promise<AdvancedChecklist | null> {
    try {
      const db = await this.getDb();
      const checklistId = parseInt(id);
      if (isNaN(checklistId)) {
        return null;
      }

      const [checklist] = await db
        .select()
        .from(advancedChecklists)
        .where(eq(advancedChecklists.id, checklistId));
      
      if (!checklist) {
        return null;
      }

      // Fetch stages
      const stages = await db
        .select()
        .from(checklistStages)
        .where(eq(checklistStages.checklistId, checklistId))
        .orderBy(checklistStages.order);

      // Fetch criteria for all stages
      const stagesWithCriteria = await Promise.all(
        stages.map(async (stage: any) => {
          const criteria = await db
            .select()
            .from(checklistCriteria)
            .where(eq(checklistCriteria.stageId, stage.id));

          return {
            id: stage.id.toString(),
            name: stage.name,
            order: stage.order,
            criteria: criteria.map((c: any) => ({
              id: c.id.toString(),
              number: c.number,
              title: c.title,
              description: c.description,
              weight: c.weight,
              isBinary: c.isBinary,
              ...(c.levels ? {
                max: c.levels.max,
                mid: c.levels.mid,
                min: c.levels.min,
              } : {}),
            })),
          };
        })
      );

      return {
        id: checklist.id.toString(),
        name: checklist.name,
        version: checklist.version,
        type: 'advanced' as const,
        totalScore: checklist.totalScore,
        stages: stagesWithCriteria,
        createdAt: checklist.createdAt,
        updatedAt: checklist.updatedAt,
      };
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedChecklistWithStages', id });
      throw error;
    }
  }

  async updateAdvancedChecklist(id: string, updates: Partial<AdvancedChecklist>): Promise<void> {
    try {
      const db = await this.getDb();
      await db
        .update(advancedChecklists)
        .set({
          name: updates.name,
          version: updates.version,
          totalScore: updates.totalScore,
        })
        .where(eq(advancedChecklists.id, parseInt(id)));
    } catch (error) {
      logger.error('storage', error, { operation: 'updateAdvancedChecklist', id });
      throw error;
    }
  }

  async deleteAdvancedChecklist(id: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.delete(advancedChecklists).where(eq(advancedChecklists.id, parseInt(id)));
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
      const db = await this.getDb();
      await db
        .insert(advancedAnalyses)
        .values({
          report: JSON.stringify(report),
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
      const db = await this.getDb();
      const results = await db
        .select()
        .from(advancedAnalyses)
        .where(eq(advancedAnalyses.checklistId, parseInt(checklistId)))
        .orderBy(desc(advancedAnalyses.analyzedAt));
      
      return results.map((r: any) => this.safeParse(r.report));
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedChecklistReports' });
      throw error;
    }
  }

  // Advanced analysis methods
  async saveAdvancedAnalysis(
    result: any,
    checklistId: string,
    transcript: string,
    managerId?: string,
    source: string = 'call',
    language: string = 'ru',
    userId?: string,
    transcriptId?: string
  ): Promise<string> {
    try {
      const db = await this.getDb();
      
      // First, clean up old advanced analyses to keep only the last 5 per user
      if (userId) {
        await this.cleanupOldAdvancedAnalyses(userId);
      }
      
      const analysis = {
        source,
        language,
        transcript,
        report: result,
        analyzedAt: new Date(),
        managerId: managerId ? parseInt(managerId) : null,
        userId: userId ? parseInt(userId) : null,
        checklistId: parseInt(checklistId),
        transcriptId: transcriptId ? parseInt(transcriptId) : null,
      };

      const [inserted] = await db.insert(advancedAnalyses).values(analysis as any).returning();
      return inserted.id.toString();
    } catch (error) {
      logger.error('storage', error, { operation: 'saveAdvancedAnalysis' });
      throw error;
    }
  }

  async getAdvancedAnalysis(id: string): Promise<any | null> {
    try {
      const db = await this.getDb();
      const [result] = await db
        .select()
        .from(advancedAnalyses)
        .where(eq(advancedAnalyses.id, parseInt(id)));
      
      if (!result) {
        return null;
      }

      return {
        ...result,
        report: this.safeParse(result.report),
      };
    } catch (error) {
      logger.error('storage', error, { operation: 'getAdvancedAnalysis', id });
      throw error;
    }
  }

  async getAllAdvancedAnalyses(userId?: string): Promise<any[]> {
    try {
      const db = await this.getDb();
      let query = db.select().from(advancedAnalyses);
      
      if (userId) {
        query = query.where(eq(advancedAnalyses.userId, parseInt(userId)));
      }
      
      const results = await query.orderBy(desc(advancedAnalyses.analyzedAt));
      
      return results.map((r: any) => ({
        ...r,
        report: this.safeParse(r.report),
      }));
    } catch (error) {
      logger.error('storage', error, { operation: 'getAllAdvancedAnalyses' });
      throw error;
    }
  }

  async getRecentAdvancedAnalyses(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const db = await this.getDb();
      const results = await db
        .select()
        .from(advancedAnalyses)
        .where(eq(advancedAnalyses.userId, parseInt(userId)))
        .orderBy(desc(advancedAnalyses.analyzedAt))
        .limit(limit);
      
      return results.map((r: any) => ({
        ...r,
        report: this.safeParse(r.report),
      }));
    } catch (error) {
      logger.error('storage', error, { operation: 'getRecentAdvancedAnalyses', userId });
      throw error;
    }
  }

  async cleanupOldAdvancedAnalyses(userId: string): Promise<void> {
    try {
      const db = await this.getDb();
      const userAnalyses = await db
        .select()
        .from(advancedAnalyses)
        .where(eq(advancedAnalyses.userId, parseInt(userId)))
        .orderBy(desc(advancedAnalyses.analyzedAt));

      // Keep only the last MAX_STORED_ANALYSES, delete the rest
      if (userAnalyses.length > Storage.MAX_STORED_ANALYSES) {
        const toDelete = userAnalyses
          .slice(Storage.MAX_STORED_ANALYSES)
          .map((a: any) => a.id);

        if (toDelete.length > 0) {
          await db.delete(advancedAnalyses).where(inArray(advancedAnalyses.id, toDelete));
          logger.info(
            'storage',
            `Cleaned up ${toDelete.length} old advanced analyses for user ${userId}`
          );
        }
      }
    } catch (error) {
      logger.error('storage', error, { operation: 'cleanupOldAdvancedAnalyses', userId });
      // Don't throw - cleanup failure shouldn't prevent analysis save
    }
  }

  // Manager methods
  async createManager(manager: InsertManager): Promise<Manager> {
    try {
      const db = await this.getDb();
      const [inserted] = await db.insert(managers).values(manager as any).returning();
      return inserted;
    } catch (error) {
      logger.error('storage', error, { operation: 'createManager', manager });
      throw error;
    }
  }

  async getManagers(): Promise<Manager[]> {
    try {
      const db = await this.getDb();
      return await db.select().from(managers);
    } catch (error) {
      logger.error('storage', error, { operation: 'getManagers' });
      throw error;
    }
  }

  async getManagerById(id: string): Promise<Manager | null> {
    try {
      const db = await this.getDb();
      const [result] = await db
        .select()
        .from(managers)
        .where(eq(managers.id, parseInt(id)));
      return result || null;
    } catch (error) {
      logger.error('storage', error, { operation: 'getManagerById', id });
      throw error;
    }
  }

  async getManager(id: string): Promise<Manager | null> {
    return this.getManagerById(id);
  }

  async updateManager(id: string, updates: Partial<Manager>): Promise<Manager | null> {
    try {
      const db = await this.getDb();
      const [updated] = await db
        .update(managers)
        .set(updates)
        .where(eq(managers.id, parseInt(id)))
        .returning();
      return updated || null;
    } catch (error) {
      logger.error('storage', error, { operation: 'updateManager', id });
      throw error;
    }
  }

  async deleteManager(id: string): Promise<boolean> {
    try {
      const db = await this.getDb();
      await db.delete(managers).where(eq(managers.id, parseInt(id)));
      return true;
    } catch (error) {
      logger.error('storage', error, { operation: 'deleteManager', id });
      throw error;
    }
  }
}

export { Storage };
export const storage = new Storage();

// Export variables for storage status
export const storageInitializationError: Error | null = null;
export const storageUsesDatabase = true;

// Helper function to wait for storage to be ready
export async function waitForStorage(): Promise<void> {
  // Since storage is already initialized, just return
  return Promise.resolve();
}

// Seed function to initialize default simple checklists
export async function seedDefaultChecklists(checklistsToSeed: Checklist[]): Promise<void> {
  try {
    console.log('[storage] Starting to seed default simple checklists...');
    const existing = await storage.getChecklists();
    const checklistNames = new Set(existing.map((c) => c.name));
    
    const checklistsToAdd = checklistsToSeed.filter((c) => !checklistNames.has(c.name));
    
    if (checklistsToAdd.length > 0) {
      console.log(`[storage] Seeding database with ${checklistsToAdd.length} simple checklists...`);
      for (const checklist of checklistsToAdd) {
        console.log(`[storage] Creating checklist: ${checklist.name}`);
        await storage.createChecklist(checklist);
      }
      console.log(`[storage] Successfully seeded ${checklistsToAdd.length} simple checklists`);
    } else {
      console.log("[storage] All default simple checklists already exist in database");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[storage] CRITICAL ERROR seeding simple checklists: ${errorMessage}`);
    logger.error('storage', error, { operation: 'seedDefaultChecklists' });
    throw new Error(`Failed to seed simple checklists: ${errorMessage}`);
  }
}

// Seed function to initialize default advanced checklists
export async function seedDefaultAdvancedChecklists(): Promise<void> {
  try {
    console.log('[storage] Starting to seed default advanced checklists...');
    const existing = await storage.getAdvancedChecklists();
    const checklistNames = new Set(existing.map((c) => c.name));
    
    // Seed both checklists globally (without userId/ownerId)
    const checklistsToAdd = [preTrialChecklist, forUlyanaChecklist].filter(
      (c) => !checklistNames.has(c.name)
    );
    
    if (checklistsToAdd.length > 0) {
      console.log(`[storage] Seeding database with ${checklistsToAdd.length} advanced checklists...`);
      for (const checklist of checklistsToAdd) {
        console.log(`[storage] Creating advanced checklist: ${checklist.name}`);
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

// Seed function to initialize default managers
export async function seedDefaultManagers(): Promise<void> {
  try {
    console.log('[storage] Checking for default managers...');
    const existing = await storage.getManagers();
    
    if (existing.length === 0) {
      console.log('[storage] No managers found, seeding is not required for managers');
    } else {
      console.log(`[storage] Found ${existing.length} existing managers`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[storage] Error checking managers: ${errorMessage}`);
    logger.error('storage', error, { operation: 'seedDefaultManagers' });
  }
}

// Seed function to initialize default users
export async function seedDefaultUsers(): Promise<void> {
  try {
    console.log('[storage] Default users seeding is handled by auth service');
    // User seeding is typically handled by the auth service during initialization
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[storage] Error in seedDefaultUsers: ${errorMessage}`);
    logger.error('storage', error, { operation: 'seedDefaultUsers' });
  }
}
