// Integration: blueprint:javascript_database
import { Checklist, AnalysisReport, Manager, checklists, analyses, managers } from "./shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { getDatabase, type DatabaseClient } from "./db.js";

export type StoredAnalysis = {
  id: string;
  checklistId?: string;
  managerId?: string;
  source: "call" | "correspondence";
  language: string;
  transcript: string;
  analyzedAt: Date;
  checklistReport: AnalysisReport["checklistReport"];
  objectionsReport: AnalysisReport["objectionsReport"];
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
  
  // Checklists
  getChecklists(): Promise<Checklist[]>;
  getChecklist(id: string): Promise<Checklist | undefined>;
  createChecklist(checklist: Checklist): Promise<Checklist>;
  updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined>;
  deleteChecklist(id: string): Promise<boolean>;
  
  // Analysis history
  saveAnalysis(
    analysis: AnalysisReport, 
    checklistId?: string, 
    transcript?: string,
    managerId?: string
  ): Promise<string>;
  getAnalysis(id: string): Promise<AnalysisReport | undefined>;
  getAllAnalyses(): Promise<StoredAnalysis[]>;
  deleteAnalysis(id: string): Promise<boolean>;
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
    managerId?: string
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

    const [saved] = await this.db
      .insert(analyses)
      .values({
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

  async getAllAnalyses(): Promise<StoredAnalysis[]> {
    const allAnalyses = await this.db
      .select()
      .from(analyses)
      .orderBy(desc(analyses.analyzedAt))
      .limit(10);

    return allAnalyses.map((analysis: {
      id: number;
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
}

class InMemoryStorage implements IStorage {
  private managerCounter = 1;
  private checklistCounter = 1;
  private analysisCounter = 1;
  private readonly managersStore = new Map<string, Manager>();
  private readonly checklistsStore = new Map<string, Checklist>();
  private readonly analysesStore = new Map<
    string,
    StoredAnalysis & { transcript: string; report: AnalysisReport }
  >();

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
  ): Promise<string> {
    const id = String(this.analysisCounter++);
    const stored: StoredAnalysis & { transcript: string; report: AnalysisReport } = {
      id,
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

  async getAllAnalyses(): Promise<StoredAnalysis[]> {
    return Array.from(this.analysesStore.values()).map(({ report, transcript, ...rest }) => ({
      ...rest,
      transcript,
    }));
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    return this.analysesStore.delete(id);
  }
}


function initializeStorage(): void {
  storage = new InMemoryStorage();

  getDatabase()
    .then((client) => {
      databaseClient = client;
      storage = new DatabaseStorage(client);
      storageUsesDatabase = true;
    })
    .catch((error) => {
      storageInitializationError = error instanceof Error ? error : new Error(String(error));
      storageUsesDatabase = false;
    });
}

initializeStorage();

// Seed function to initialize default managers
export async function seedDefaultManagers(): Promise<void> {
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
}

// Seed function to initialize default checklists
export async function seedDefaultChecklists(defaultChecklists: Checklist[]): Promise<void> {
  const existing = await storage.getChecklists();
  
  if (existing.length === 0) {
    console.log("Seeding database with default checklists...");
    for (const checklist of defaultChecklists) {
      await storage.createChecklist(checklist);
    }
    console.log(`Seeded ${defaultChecklists.length} default checklists`);
  }
}
