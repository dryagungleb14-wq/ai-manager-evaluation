import { Checklist } from "@/lib/rest";
import { defaultChecklists } from "./default-checklists";

const STORAGE_KEY = "manager-eval-checklists";
const ACTIVE_KEY = "manager-eval-active-checklist";

export function getStoredChecklists(): Checklist[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultChecklists;
    }
  }
  return defaultChecklists;
}

export function saveChecklists(checklists: Checklist[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
}

export function getActiveChecklistId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveChecklistId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function addChecklist(checklist: Checklist): void {
  const checklists = getStoredChecklists();
  checklists.push(checklist);
  saveChecklists(checklists);
}

export function updateChecklist(id: string, checklist: Checklist): void {
  const checklists = getStoredChecklists();
  const index = checklists.findIndex((c) => c.id === id);
  if (index !== -1) {
    checklists[index] = checklist;
    saveChecklists(checklists);
  }
}

export function deleteChecklist(id: string): void {
  const checklists = getStoredChecklists();
  const filtered = checklists.filter((c) => c.id !== id);
  saveChecklists(filtered);
}
