import { useState, useEffect } from "react";
import { Plus, Download, Upload, Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checklist } from "@shared/schema";
import {
  getStoredChecklists,
  getActiveChecklistId,
  setActiveChecklistId,
  addChecklist,
} from "@/lib/checklist-storage";
import { ChecklistEditor } from "./checklist-editor";

interface ChecklistSelectorProps {
  onChecklistChange: (checklist: Checklist) => void;
}

export function ChecklistSelector({ onChecklistChange }: ChecklistSelectorProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);

  useEffect(() => {
    const stored = getStoredChecklists();
    setChecklists(stored);
    
    const active = getActiveChecklistId();
    if (active && stored.find((c) => c.id === active)) {
      setActiveId(active);
      onChecklistChange(stored.find((c) => c.id === active)!);
    } else if (stored.length > 0) {
      setActiveId(stored[0].id);
      setActiveChecklistId(stored[0].id);
      onChecklistChange(stored[0]);
    }
  }, [onChecklistChange]);

  const handleSelectChange = (value: string) => {
    setActiveId(value);
    setActiveChecklistId(value);
    const checklist = checklists.find((c) => c.id === value);
    if (checklist) {
      onChecklistChange(checklist);
    }
  };

  const handleExport = () => {
    const checklist = checklists.find((c) => c.id === activeId);
    if (!checklist) return;

    const dataStr = JSON.stringify(checklist, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${checklist.name.replace(/\s+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text) as Checklist;
        
        // Generate new ID to avoid conflicts
        imported.id = `imported-${Date.now()}`;
        
        addChecklist(imported);
        const updated = getStoredChecklists();
        setChecklists(updated);
        setActiveId(imported.id);
        setActiveChecklistId(imported.id);
        onChecklistChange(imported);
      } catch (err) {
        console.error("Ошибка импорта:", err);
      }
    };
    input.click();
  };

  const handleDuplicate = () => {
    const checklist = checklists.find((c) => c.id === activeId);
    if (!checklist) return;

    const duplicate: Checklist = {
      ...checklist,
      id: `${checklist.id}-copy-${Date.now()}`,
      name: `${checklist.name} (копия)`,
    };

    addChecklist(duplicate);
    const updated = getStoredChecklists();
    setChecklists(updated);
    setActiveId(duplicate.id);
    setActiveChecklistId(duplicate.id);
    onChecklistChange(duplicate);
  };

  const handleCreateNew = () => {
    setEditingChecklist(null);
    setShowEditor(true);
  };

  const activeChecklist = checklists.find((c) => c.id === activeId);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Чек-лист</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={activeId} onValueChange={handleSelectChange}>
            <SelectTrigger data-testid="select-checklist">
              <SelectValue placeholder="Выберите чек-лист" />
            </SelectTrigger>
            <SelectContent>
              {checklists.map((checklist) => (
                <SelectItem key={checklist.id} value={checklist.id}>
                  {checklist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNew}
              data-testid="button-create-checklist"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={!activeId}
              data-testid="button-duplicate-checklist"
            >
              <Copy className="h-4 w-4 mr-2" />
              Дубликат
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!activeId}
              data-testid="button-export-checklist"
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              data-testid="button-import-checklist"
            >
              <Upload className="h-4 w-4 mr-2" />
              Импорт
            </Button>
          </div>

          {activeChecklist && (
            <div className="space-y-3 pt-2">
              <div className="text-sm text-muted-foreground">
                Пунктов: {activeChecklist.items.length}
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {activeChecklist.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-card border border-card-border space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      <Badge
                        variant={
                          item.type === "mandatory"
                            ? "default"
                            : item.type === "recommended"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs shrink-0"
                      >
                        {item.type === "mandatory"
                          ? "Обязательный"
                          : item.type === "recommended"
                          ? "Рекомендуемый"
                          : "Запрещённый"}
                      </Badge>
                    </div>
                    {item.criteria.llm_hint && (
                      <p className="text-xs text-muted-foreground">
                        {item.criteria.llm_hint}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showEditor && (
        <ChecklistEditor
          checklist={editingChecklist}
          onClose={() => setShowEditor(false)}
          onSave={(checklist) => {
            addChecklist(checklist);
            const updated = getStoredChecklists();
            setChecklists(updated);
            setActiveId(checklist.id);
            setActiveChecklistId(checklist.id);
            onChecklistChange(checklist);
            setShowEditor(false);
          }}
        />
      )}
    </>
  );
}
