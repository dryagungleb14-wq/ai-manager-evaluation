// Integration: blueprint:javascript_database
import { Checklist, AnalysisReport, Manager, checklists, analyses, managers } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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
  getAllAnalyses(): Promise<Array<{
    id: string;
    checklistId?: string;
    managerId?: string;
    source: string;
    language: string;
    transcript: string;
    analyzedAt: Date;
    checklistReport: any;
    objectionsReport: any;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // Managers implementation
  async getManagers(): Promise<Manager[]> {
    const dbManagers = await db.select().from(managers);
    
    return dbManagers.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      phone: m.phone,
      email: m.email,
      teamLead: m.teamLead,
      department: m.department,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async getManager(id: string): Promise<Manager | undefined> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return undefined;

    const [manager] = await db
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
    const [created] = await db
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

    const [updated] = await db
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

    const result = await db
      .delete(managers)
      .where(eq(managers.id, numId))
      .returning();

    return result.length > 0;
  }

  // Checklists implementation
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

    const [saved] = await db
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

  async getAllAnalyses() {
    const allAnalyses = await db
      .select()
      .from(analyses)
      .orderBy(desc(analyses.analyzedAt))
      .limit(10);

    return allAnalyses.map((a) => ({
      id: a.id.toString(),
      checklistId: a.checklistId?.toString(),
      managerId: a.managerId?.toString(),
      source: a.source,
      language: a.language,
      transcript: a.transcript,
      analyzedAt: a.analyzedAt,
      checklistReport: a.checklistReport,
      objectionsReport: a.objectionsReport,
    }));
  }
}

export const storage = new DatabaseStorage();

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
