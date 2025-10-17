import { Checklist, AnalysisReport } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Checklists
  getChecklists(): Promise<Checklist[]>;
  getChecklist(id: string): Promise<Checklist | undefined>;
  createChecklist(checklist: Checklist): Promise<Checklist>;
  updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined>;
  deleteChecklist(id: string): Promise<boolean>;
  
  // Analysis history (optional for MVP, stored in-memory temporarily)
  saveAnalysis(analysis: AnalysisReport): Promise<string>;
  getAnalysis(id: string): Promise<AnalysisReport | undefined>;
}

export class MemStorage implements IStorage {
  private checklists: Map<string, Checklist>;
  private analyses: Map<string, AnalysisReport>;

  constructor() {
    this.checklists = new Map();
    this.analyses = new Map();
  }

  async getChecklists(): Promise<Checklist[]> {
    return Array.from(this.checklists.values());
  }

  async getChecklist(id: string): Promise<Checklist | undefined> {
    return this.checklists.get(id);
  }

  async createChecklist(checklist: Checklist): Promise<Checklist> {
    this.checklists.set(checklist.id, checklist);
    return checklist;
  }

  async updateChecklist(id: string, checklist: Checklist): Promise<Checklist | undefined> {
    if (!this.checklists.has(id)) {
      return undefined;
    }
    this.checklists.set(id, checklist);
    return checklist;
  }

  async deleteChecklist(id: string): Promise<boolean> {
    return this.checklists.delete(id);
  }

  async saveAnalysis(analysis: AnalysisReport): Promise<string> {
    const id = randomUUID();
    this.analyses.set(id, analysis);
    return id;
  }

  async getAnalysis(id: string): Promise<AnalysisReport | undefined> {
    return this.analyses.get(id);
  }
}

export const storage = new MemStorage();
