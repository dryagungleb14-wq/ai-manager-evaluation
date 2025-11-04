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

export type StoredAnalysis = {
  id: string;
  userId?: string;
  checklistId?: string;
  managerId?: string;
  source: "call" | "correspondence";
  language: string;
  transcript: string;
  analyzedAt: Date;
  checklistReport: AnalysisReport["checklistReport"];
  objectionsReport: AnalysisReport["objectionsReport"];
};

export type StoredAdvancedAnalysis = {
  id: string;
  userId?: string;
  checklistId?: string;
  managerId?: string;
  source: "call" | "correspondence";
  language: string;
  transcript: string;
  analyzedAt: Date;
  report: AdvancedChecklistReport;
};

let databaseClient: DatabaseClient | null = null;
export let storageInitializationError: Error | null = null;
export let storageUsesDatabase = false;

export interface IStorage {
  // Managers
  getManagers(): Promise<Manager[]>;
  getManager(id: string): Promise<Manager | undefined>;
  createManager(manager: Omit<Manager, 'id' | 'createdAt' | 'updatedAt'>): Promise<Manager>;
  updateManager(id: string, manager: Partial<Omit<Manager, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Manager | undefined>;
  deleteManager(id: string): Promise<boolean>;
  
  // Checklists (simple)
  getChecklists(): Promise<Checklist[]>;
  getChecklist(id: string): Promise<Checklist | undefined>;
  createChecklist(checklist: Checklist): Promise<Checklist>;
  updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined>;
  deleteChecklist(id: string): Promise<boolean>;
  
  // Advanced Checklists
  getAdvancedChecklists(): Promise<AdvancedChecklist[]>;
  getAdvancedChecklist(id: string): Promise<AdvancedChecklist | undefined>;
  getAdvancedChecklistWithStages(id: string): Promise<AdvancedChecklist | undefined>;
  createAdvancedChecklist(checklist: AdvancedChecklist): Promise<AdvancedChecklist>;
  updateAdvancedChecklist(id: string, checklist: AdvancedChecklist): Promise<AdvancedChecklist | undefined>;
  deleteAdvancedChecklist(id: string): Promise<boolean>;
  
  // Analysis history (simple)
  saveAnalysis(
    analysis: AnalysisReport, 
    checklistId?: string, 
    transcript?: string,
    managerId?: string,
    userId?: string
  ): Promise<string>;
  getAnalysis(id: string): Promise<AnalysisReport | undefined>;
  getAllAnalyses(userId?: string): Promise<StoredAnalysis[]>;
  deleteAnalysis(id: string): Promise<boolean>;
  
  // Advanced Analysis history
  saveAdvancedAnalysis(
    report: AdvancedChecklistReport,
    checklistId?: string,
    transcript?: string,
    managerId?: string,
    source?: "call" | "correspondence",
    language?: string,
    userId?: string
  ): Promise<string>;
  getAdvancedAnalysis(id: string): Promise<AdvancedChecklistReport | undefined>;
  getAllAdvancedAnalyses(userId?: string): Promise<StoredAdvancedAnalysis[]>;
  deleteAdvancedAnalysis(id: string): Promise<boolean>;
}

export let storage: IStorage;

export class DatabaseStorage implements IStorage {
  constructor(private readonly db: DatabaseClient) {}

  // Managers implementation
  async getManagers(): Promise<Manager[]> {
    const dbManagers = await this.db.select().from(managers);
    
    return dbManagers.map((managerRow: {
      id: number;
      name: string;
      phone: string | null;
      email: string | null;
      teamLead: string | null;
      department: string | null;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
      id: managerRow.id.toString(),
      name: managerRow.name,
      phone: managerRow.phone,
      email: managerRow.email,
      teamLead: managerRow.teamLead,
      department: managerRow.department,
      createdAt: managerRow.createdAt,
      updatedAt: managerRow.updatedAt,
    }));
  }

  async getManager(id: string): Promise<Manager | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [manager] = await this.db
      .select()
      .from(managers)
      .where(eq(managers.id, numId));

    if (!manager) return undefined;

    return {
      id: manager.id.toString(),
      name: manager.name,
      phone: manager.phone,
      email: manager.email,
      teamLead: manager.teamLead,
      department: manager.department,
      createdAt: manager.createdAt,
      updatedAt: manager.updatedAt,
    };
  }

  async createManager(manager: Omit<Manager, 'id' | 'createdAt' | 'updatedAt'>): Promise<Manager> {
    const [created] = await this.db
      .insert(managers)
      .values({
        name: manager.name,
        phone: manager.phone,
        email: manager.email,
        teamLead: manager.teamLead,
        department: manager.department,
      })
      .returning();

    return {
      id: created.id.toString(),
      name: created.name,
      phone: created.phone,
      email: created.email,
      teamLead: created.teamLead,
      department: created.department,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateManager(id: string, manager: Partial<Omit<Manager, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Manager | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [updated] = await this.db
      .update(managers)
      .set({
        ...manager,
        updatedAt: new Date(),
      })
      .where(eq(managers.id, numId))
      .returning();

    if (!updated) return undefined;

    return {
      id: updated.id.toString(),
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      teamLead: updated.teamLead,
      department: updated.department,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteManager(id: string): Promise<boolean> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return false;

    const result = await this.db
      .delete(managers)
      .where(eq(managers.id, numId))
      .returning();

    return result.length > 0;
  }

  // Checklists implementation
  async getChecklists(): Promise<Checklist[]> {
    const dbChecklists = await this.db.select().from(checklists);
    
    return dbChecklists.map((checklistRow: {
      id: number;
      name: string;
      version: string;
      items: Checklist["items"];
    }) => ({
      id: checklistRow.id.toString(),
      name: checklistRow.name,
      version: checklistRow.version,
      items: checklistRow.items,
    }));
  }

  async getChecklist(id: string): Promise<Checklist | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [checklist] = await this.db
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
    const [created] = await this.db
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

    const [updated] = await this.db
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

    const result = await this.db
      .delete(checklists)
      .where(eq(checklists.id, numId))
      .returning();

    return result.length > 0;
  }

  async saveAnalysis(
    analysis: AnalysisReport, 
    checklistId?: string,
    transcript?: string,
    managerId?: string,
    userId?: string
  ): Promise<string> {
    // Only use checklistId if it's a valid numeric ID
    let numericChecklistId: number | null = null;
    if (checklistId) {
      const parsed = parseInt(checklistId, 10);
      if (!isNaN(parsed)) {
        numericChecklistId = parsed;
      }
    }

    // Only use managerId if it's a valid numeric ID
    let numericManagerId: number | null = null;
    if (managerId) {
      const parsed = parseInt(managerId, 10);
      if (!isNaN(parsed)) {
        numericManagerId = parsed;
      }
    }

    // Only use userId if it's a valid numeric ID
    let numericUserId: number | null = null;
    if (userId) {
      const parsed = parseInt(userId, 10);
      if (!isNaN(parsed)) {
        numericUserId = parsed;
      }
    }

    const [saved] = await this.db
      .insert(analyses)
      .values({
        userId: numericUserId,
        checklistId: numericChecklistId,
        managerId: numericManagerId,
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

    const [analysis] = await this.db
      .select()
      .from(analyses)
      .where(eq(analyses.id, numId));

    if (!analysis) return undefined;

    return {
      checklistReport: analysis.checklistReport,
      objectionsReport: analysis.objectionsReport,
    };
  }

  async getAllAnalyses(userId?: string): Promise<StoredAnalysis[]> {
    let query = this.db
      .select()
      .from(analyses);

    // Filter by userId if provided
    if (userId) {
      const numericUserId = parseInt(userId, 10);
      if (!isNaN(numericUserId)) {
        query = query.where(eq(analyses.userId, numericUserId)) as any;
      }
    }

    const allAnalyses = await query
      .orderBy(desc(analyses.analyzedAt))
      .limit(100); // Increased limit for admin view

    return allAnalyses.map((analysis: {
      id: number;
      userId: number | null;
      checklistId: number | null;
      managerId: number | null;
      source: "call" | "correspondence";
      language: string;
      transcript: string;
      analyzedAt: Date;
      checklistReport: AnalysisReport["checklistReport"];
      objectionsReport: AnalysisReport["objectionsReport"];
    }) => ({
      id: analysis.id.toString(),
      userId: analysis.userId?.toString(),
      checklistId: analysis.checklistId?.toString(),
      managerId: analysis.managerId?.toString(),
      source: analysis.source,
      language: analysis.language,
      transcript: analysis.transcript,
      analyzedAt: analysis.analyzedAt,
      checklistReport: analysis.checklistReport,
      objectionsReport: analysis.objectionsReport,
    }));
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return false;

    const result = await this.db
      .delete(analyses)
      .where(eq(analyses.id, numId))
      .returning();

    return result.length > 0;
  }

  // Advanced Checklist methods
  async getAdvancedChecklists(): Promise<AdvancedChecklist[]> {
    const dbChecklists = await this.db.select().from(advancedChecklists);
    
    const results: AdvancedChecklist[] = [];
    for (const checklist of dbChecklists) {
      const stages = await this.db
        .select()
        .from(checklistStages)
        .where(eq(checklistStages.checklistId, checklist.id));
      
      const stagesWithCriteria = await Promise.all(
        stages.map(async (stage: any) => {
          const criteria = await this.db
            .select()
            .from(checklistCriteria)
            .where(eq(checklistCriteria.stageId, stage.id));
          
          return {
            id: stage.id.toString(),
            name: stage.name,
            order: stage.order,
            criteria: criteria.map((c: any) => ({
              id: c.id.toString(),
              number: c.number || "",
              title: c.title,
              description: c.description || "",
              weight: c.weight,
              isBinary: c.isBinary || false,
              ...(c.levels || {}),
            })),
          };
        })
      );
      
      results.push({
        id: checklist.id.toString(),
        name: checklist.name,
        version: checklist.version,
        type: "advanced",
        totalScore: checklist.totalScore,
        stages: stagesWithCriteria,
        createdAt: checklist.createdAt,
        updatedAt: checklist.updatedAt,
      });
    }
    
    return results;
  }

  async getAdvancedChecklist(id: string): Promise<AdvancedChecklist | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [checklist] = await this.db
      .select()
      .from(advancedChecklists)
      .where(eq(advancedChecklists.id, numId));

    if (!checklist) return undefined;

    return {
      id: checklist.id.toString(),
      name: checklist.name,
      version: checklist.version,
      type: "advanced",
      totalScore: checklist.totalScore,
      stages: [],
      createdAt: checklist.createdAt,
      updatedAt: checklist.updatedAt,
    };
  }

  async getAdvancedChecklistWithStages(id: string): Promise<AdvancedChecklist | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [checklist] = await this.db
      .select()
      .from(advancedChecklists)
      .where(eq(advancedChecklists.id, numId));

    if (!checklist) return undefined;

    const stages = await this.db
      .select()
      .from(checklistStages)
      .where(eq(checklistStages.checklistId, checklist.id));
    
    const stagesWithCriteria = await Promise.all(
      stages.map(async (stage: any) => {
        const criteria = await this.db
          .select()
          .from(checklistCriteria)
          .where(eq(checklistCriteria.stageId, stage.id));
        
        return {
          id: stage.id.toString(),
          name: stage.name,
          order: stage.order,
          criteria: criteria.map((c: any) => ({
            id: c.id.toString(),
            number: c.number || "",
            title: c.title,
            description: c.description || "",
            weight: c.weight,
            isBinary: c.isBinary || false,
            ...(c.levels || {}),
          })),
        };
      })
    );

    return {
      id: checklist.id.toString(),
      name: checklist.name,
      version: checklist.version,
      type: "advanced",
      totalScore: checklist.totalScore,
      stages: stagesWithCriteria,
      createdAt: checklist.createdAt,
      updatedAt: checklist.updatedAt,
    };
  }

  async createAdvancedChecklist(checklist: AdvancedChecklist): Promise<AdvancedChecklist> {
    const [created] = await this.db
      .insert(advancedChecklists)
      .values({
        name: checklist.name,
        version: checklist.version,
        totalScore: checklist.totalScore,
      })
      .returning();

    // Create stages and criteria
    for (const stage of checklist.stages) {
      const [createdStage] = await this.db
        .insert(checklistStages)
        .values({
          checklistId: created.id,
          name: stage.name,
          order: stage.order,
        })
        .returning();

      for (const criterion of stage.criteria) {
        await this.db
          .insert(checklistCriteria)
          .values({
            stageId: createdStage.id,
            number: criterion.number,
            title: criterion.title,
            description: criterion.description,
            weight: criterion.weight,
            isBinary: criterion.isBinary || false,
            levels: {
              max: criterion.max,
              mid: criterion.mid,
              min: criterion.min,
            },
          });
      }
    }

    // Record history
    await this.db
      .insert(checklistHistory)
      .values({
        checklistId: created.id,
        action: "created",
        changes: null,
        userId: null,
      });

    return this.getAdvancedChecklistWithStages(created.id.toString()) as Promise<AdvancedChecklist>;
  }

  async updateAdvancedChecklist(id: string, checklist: AdvancedChecklist): Promise<AdvancedChecklist | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [updated] = await this.db
      .update(advancedChecklists)
      .set({
        name: checklist.name,
        version: checklist.version,
        totalScore: checklist.totalScore,
        updatedAt: new Date(),
      })
      .where(eq(advancedChecklists.id, numId))
      .returning();

    if (!updated) return undefined;

    // Record history
    await this.db
      .insert(checklistHistory)
      .values({
        checklistId: updated.id,
        action: "updated",
        changes: { name: checklist.name, version: checklist.version },
        userId: null,
      });

    return this.getAdvancedChecklistWithStages(updated.id.toString());
  }

  async deleteAdvancedChecklist(id: string): Promise<boolean> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return false;

    // Record history before deletion
    await this.db
      .insert(checklistHistory)
      .values({
        checklistId: numId,
        action: "deleted",
        changes: null,
        userId: null,
      });

    const result = await this.db
      .delete(advancedChecklists)
      .where(eq(advancedChecklists.id, numId))
      .returning();

    return result.length > 0;
  }

  async saveAdvancedAnalysis(
    report: AdvancedChecklistReport,
    checklistId?: string,
    transcript?: string,
    managerId?: string,
    source: "call" | "correspondence" = "call",
    language: string = "ru",
    userId?: string
  ): Promise<string> {
    let numericChecklistId: number | null = null;
    if (checklistId) {
      const parsed = parseInt(checklistId, 10);
      if (!isNaN(parsed)) {
        numericChecklistId = parsed;
      }
    }

    let numericManagerId: number | null = null;
    if (managerId) {
      const parsed = parseInt(managerId, 10);
      if (!isNaN(parsed)) {
        numericManagerId = parsed;
      }
    }

    let numericUserId: number | null = null;
    if (userId) {
      const parsed = parseInt(userId, 10);
      if (!isNaN(parsed)) {
        numericUserId = parsed;
      }
    }

    const [saved] = await this.db
      .insert(advancedAnalyses)
      .values({
        userId: numericUserId,
        checklistId: numericChecklistId,
        managerId: numericManagerId,
        source,
        language,
        transcript: transcript || "",
        report,
      })
      .returning();

    return saved.id.toString();
  }

  async getAdvancedAnalysis(id: string): Promise<AdvancedChecklistReport | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [analysis] = await this.db
      .select()
      .from(advancedAnalyses)
      .where(eq(advancedAnalyses.id, numId));

    if (!analysis) return undefined;

    return analysis.report;
  }

  async getAllAdvancedAnalyses(userId?: string): Promise<StoredAdvancedAnalysis[]> {
    let query = this.db
      .select()
      .from(advancedAnalyses);

    // Filter by userId if provided
    if (userId) {
      const numericUserId = parseInt(userId, 10);
      if (!isNaN(numericUserId)) {
        query = query.where(eq(advancedAnalyses.userId, numericUserId)) as any;
      }
    }

    const allAnalyses = await query
      .orderBy(desc(advancedAnalyses.analyzedAt))
      .limit(100); // Increased limit for admin view

    return allAnalyses.map((analysis: any) => ({
      id: analysis.id.toString(),
      userId: analysis.userId?.toString(),
      checklistId: analysis.checklistId?.toString(),
      managerId: analysis.managerId?.toString(),
      source: analysis.source,
      language: analysis.language,
      transcript: analysis.transcript,
      analyzedAt: analysis.analyzedAt,
      report: analysis.report,
    }));
  }

  async deleteAdvancedAnalysis(id: string): Promise<boolean> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return false;

    const result = await this.db
      .delete(advancedAnalyses)
      .where(eq(advancedAnalyses.id, numId))
      .returning();

    return result.length > 0;
  }
}

class InMemoryStorage implements IStorage {
  private managerCounter = 1;
  private checklistCounter = 1;
  private analysisCounter = 1;
  private advancedChecklistCounter = 1;
  private advancedAnalysisCounter = 1;
  private readonly managersStore = new Map<string, Manager>();
  private readonly checklistsStore = new Map<string, Checklist>();
  private readonly analysesStore = new Map<
    string,
    StoredAnalysis & { transcript: string; report: AnalysisReport }
  >();
  private readonly advancedChecklistsStore = new Map<string, AdvancedChecklist>();
  private readonly advancedAnalysesStore = new Map<string, StoredAdvancedAnalysis>();

  async getManagers(): Promise<Manager[]> {
    return Array.from(this.managersStore.values()).map(manager => ({ ...manager }));
  }

  async getManager(id: string): Promise<Manager | undefined> {
    const manager = this.managersStore.get(id);
    return manager ? { ...manager } : undefined;
  }

  async createManager(manager: Omit<Manager, "id" | "createdAt" | "updatedAt">): Promise<Manager> {
    const id = String(this.managerCounter++);
    const now = new Date();
    const stored: Manager = {
      id,
      name: manager.name,
      phone: manager.phone ?? null,
      email: manager.email ?? null,
      teamLead: manager.teamLead ?? null,
      department: manager.department ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.managersStore.set(id, stored);
    return { ...stored };
  }

  async updateManager(
    id: string,
    manager: Partial<Omit<Manager, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Manager | undefined> {
    const existing = this.managersStore.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: Manager = {
      ...existing,
      ...manager,
      updatedAt: new Date(),
    };
    this.managersStore.set(id, updated);
    return { ...updated };
  }

  async deleteManager(id: string): Promise<boolean> {
    return this.managersStore.delete(id);
  }

  async getChecklists(): Promise<Checklist[]> {
    return Array.from(this.checklistsStore.values()).map(checklist => ({ ...checklist }));
  }

  async getChecklist(id: string): Promise<Checklist | undefined> {
    const checklist = this.checklistsStore.get(id);
    return checklist ? { ...checklist, items: checklist.items.map(item => ({ ...item })) } : undefined;
  }

  async createChecklist(checklist: Checklist): Promise<Checklist> {
    const id = checklist.id ?? String(this.checklistCounter++);
    const stored: Checklist = {
      ...checklist,
      id,
      items: checklist.items.map(item => ({ ...item })),
    };
    this.checklistsStore.set(id, stored);
    return { ...stored, items: stored.items.map(item => ({ ...item })) };
  }

  async updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined> {
    if (!this.checklistsStore.has(id)) {
      return undefined;
    }
    const stored: Checklist = {
      ...checklist,
      id,
      items: checklist.items.map(item => ({ ...item })),
    };
    this.checklistsStore.set(id, stored);
    return { ...stored, items: stored.items.map(item => ({ ...item })) };
  }

  async deleteChecklist(id: string): Promise<boolean> {
    return this.checklistsStore.delete(id);
  }

  async saveAnalysis(
    analysis: AnalysisReport,
    checklistId?: string,
    transcript?: string,
    managerId?: string,
    userId?: string
  ): Promise<string> {
    const id = String(this.analysisCounter++);
    const stored: StoredAnalysis & { transcript: string; report: AnalysisReport } = {
      id,
      userId,
      checklistId,
      managerId,
      source: analysis.checklistReport.meta.source,
      language: analysis.checklistReport.meta.language,
      transcript: transcript ?? "",
      analyzedAt: new Date(),
      checklistReport: analysis.checklistReport,
      objectionsReport: analysis.objectionsReport,
      report: analysis,
    };
    this.analysesStore.set(id, stored);
    return id;
  }

  async getAnalysis(id: string): Promise<AnalysisReport | undefined> {
    const stored = this.analysesStore.get(id);
    return stored ? stored.report : undefined;
  }

  async getAllAnalyses(userId?: string): Promise<StoredAnalysis[]> {
    let analyses = Array.from(this.analysesStore.values());
    
    // Filter by userId if provided
    if (userId) {
      analyses = analyses.filter(a => a.userId === userId);
    }
    
    return analyses.map(({ report, transcript, ...rest }) => ({
      ...rest,
      transcript,
    }));
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    return this.analysesStore.delete(id);
  }

  // Advanced Checklist methods for InMemoryStorage
  async getAdvancedChecklists(): Promise<AdvancedChecklist[]> {
    return Array.from(this.advancedChecklistsStore.values()).map(checklist => ({ ...checklist }));
  }

  async getAdvancedChecklist(id: string): Promise<AdvancedChecklist | undefined> {
    const checklist = this.advancedChecklistsStore.get(id);
    return checklist ? { ...checklist } : undefined;
  }

  async getAdvancedChecklistWithStages(id: string): Promise<AdvancedChecklist | undefined> {
    return this.getAdvancedChecklist(id);
  }

  async createAdvancedChecklist(checklist: AdvancedChecklist): Promise<AdvancedChecklist> {
    const id = checklist.id || String(this.advancedChecklistCounter++);
    const now = new Date();
    const stored: AdvancedChecklist = {
      ...checklist,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.advancedChecklistsStore.set(id, stored);
    return { ...stored };
  }

  async updateAdvancedChecklist(id: string, checklist: AdvancedChecklist): Promise<AdvancedChecklist | undefined> {
    if (!this.advancedChecklistsStore.has(id)) {
      return undefined;
    }
    const stored: AdvancedChecklist = {
      ...checklist,
      id,
      updatedAt: new Date(),
    };
    this.advancedChecklistsStore.set(id, stored);
    return { ...stored };
  }

  async deleteAdvancedChecklist(id: string): Promise<boolean> {
    return this.advancedChecklistsStore.delete(id);
  }

  async saveAdvancedAnalysis(
    report: AdvancedChecklistReport,
    checklistId?: string,
    transcript?: string,
    managerId?: string,
    source: "call" | "correspondence" = "call",
    language: string = "ru",
    userId?: string
  ): Promise<string> {
    const id = String(this.advancedAnalysisCounter++);
    const stored: StoredAdvancedAnalysis = {
      id,
      userId,
      checklistId,
      managerId,
      source,
      language,
      transcript: transcript || "",
      analyzedAt: new Date(),
      report,
    };
    this.advancedAnalysesStore.set(id, stored);
    return id;
  }

  async getAdvancedAnalysis(id: string): Promise<AdvancedChecklistReport | undefined> {
    const stored = this.advancedAnalysesStore.get(id);
    return stored ? stored.report : undefined;
  }

  async getAllAdvancedAnalyses(userId?: string): Promise<StoredAdvancedAnalysis[]> {
    let analyses = Array.from(this.advancedAnalysesStore.values());
    
    // Filter by userId if provided
    if (userId) {
      analyses = analyses.filter(a => a.userId === userId);
    }
    
    return analyses.map(analysis => ({ ...analysis }));
  }

  async deleteAdvancedAnalysis(id: string): Promise<boolean> {
    return this.advancedAnalysesStore.delete(id);
  }
}


let storageReadyPromise: Promise<void> | undefined;

function initializeStorage(): void {
  storage = new InMemoryStorage();
  console.log("[storage] Initializing storage layer with in-memory fallback...");

  storageReadyPromise = getDatabase()
    .then((client) => {
      databaseClient = client;
      storage = new DatabaseStorage(client);
      storageUsesDatabase = true;
      console.log("[storage] Database connection successful. Using PostgreSQL/SQLite storage.");
    })
    .catch((error) => {
      storageInitializationError = error instanceof Error ? error : new Error(String(error));
      storageUsesDatabase = false;
      console.warn("[storage] Database connection failed. Operating in DEGRADED MODE with in-memory storage.");
      console.warn(`[storage] Error: ${storageInitializationError.message}`);
      console.warn("[storage] Data will not persist across restarts. Consider fixing database connection.");
    });
}

initializeStorage();

/**
 * Wait for storage to be initialized (either database or in-memory fallback)
 * This should be called before seeding or using storage to ensure it's ready
 */
export async function waitForStorage(): Promise<void> {
  if (storageReadyPromise) {
    await storageReadyPromise;
  }
}

// Seed function to initialize default managers
export async function seedDefaultManagers(): Promise<void> {
  try {
    const existing = await storage.getManagers();
    
    if (existing.length === 0) {
      console.log("Seeding database with default managers...");
      
      const defaultManagers = [
        { name: "Алексей Смирнов", phone: "+7 (915) 123-45-67", email: "a.smirnov@company.ru", teamLead: "Иванов И.И.", department: "Продажи B2B" },
        { name: "Мария Петрова", phone: "+7 (916) 234-56-78", email: "m.petrova@company.ru", teamLead: "Иванов И.И.", department: "Продажи B2B" },
        { name: "Дмитрий Ковалёв", phone: "+7 (917) 345-67-89", email: "d.kovalev@company.ru", teamLead: "Иванов И.И.", department: "Продажи B2B" },
        { name: "Елена Соколова", phone: "+7 (918) 456-78-90", email: "e.sokolova@company.ru", teamLead: "Сидоров С.С.", department: "Продажи B2C" },
        { name: "Иван Новиков", phone: "+7 (919) 567-89-01", email: "i.novikov@company.ru", teamLead: "Сидоров С.С.", department: "Продажи B2C" },
        { name: "Ольга Морозова", phone: "+7 (920) 678-90-12", email: "o.morozova@company.ru", teamLead: "Сидоров С.С.", department: "Продажи B2C" },
        { name: "Сергей Волков", phone: "+7 (921) 789-01-23", email: "s.volkov@company.ru", teamLead: "Кузнецов К.К.", department: "Поддержка" },
        { name: "Анна Федорова", phone: "+7 (922) 890-12-34", email: "a.fedorova@company.ru", teamLead: "Кузнецов К.К.", department: "Поддержка" },
      ];
      
      for (const manager of defaultManagers) {
        await storage.createManager(manager);
      }
      
      console.log(`Seeded ${defaultManagers.length} default managers`);
    }
  } catch (error) {
    console.warn("[storage] Failed to seed managers:", error instanceof Error ? error.message : String(error));
    console.warn("[storage] Continuing with empty managers database");
  }
}

// Seed function to initialize default users for authentication
export async function seedDefaultUsers(): Promise<void> {
  try {
    const db = await getDatabase();
    
    const existing = await db.select().from(users);
    
    if (existing.length === 0) {
      console.log("Seeding database with default users...");
      
      const { createUser } = await import("./services/auth.js");
      
      // Create admin user
      await createUser("admin", "admin123", "admin");
      console.log("Created admin user (username: admin, password: admin123)");
      
      // Create two test users for managers
      await createUser("manager1", "manager123", "user");
      console.log("Created manager1 user (username: manager1, password: manager123)");
      
      await createUser("manager2", "manager123", "user");
      console.log("Created manager2 user (username: manager2, password: manager123)");
      
      console.log("Seeded 3 default users (1 admin, 2 managers)");
    }
  } catch (error) {
    console.warn("[storage] Failed to seed users:", error instanceof Error ? error.message : String(error));
    console.warn("[storage] Continuing without seeded users - use in-memory users for authentication");
  }
}

// Seed function to initialize default checklists
export async function seedDefaultChecklists(defaultChecklists: Checklist[]): Promise<void> {
  try {
    const existing = await storage.getChecklists();
    
    if (existing.length === 0) {
      console.log("Seeding database with default checklists...");
      for (const checklist of defaultChecklists) {
        await storage.createChecklist(checklist);
      }
      console.log(`Seeded ${defaultChecklists.length} default checklists`);
    }
  } catch (error) {
    console.warn("[storage] Failed to seed checklists:", error instanceof Error ? error.message : String(error));
    console.warn("[storage] Continuing with empty checklist database");
  }
}

// Seed function to initialize default advanced checklists
export async function seedDefaultAdvancedChecklists(defaultAdvancedChecklists: AdvancedChecklist[]): Promise<void> {
  try {
    const existing = await storage.getAdvancedChecklists();
    
    if (existing.length === 0) {
      console.log("Seeding database with default advanced checklists...");
      for (const checklist of defaultAdvancedChecklists) {
        await storage.createAdvancedChecklist(checklist);
      }
      console.log(`Seeded ${defaultAdvancedChecklists.length} default advanced checklists`);
    }
  } catch (error) {
    console.warn("[storage] Failed to seed advanced checklists:", error instanceof Error ? error.message : String(error));
    console.warn("[storage] Continuing with empty advanced checklist database");
  }
}
