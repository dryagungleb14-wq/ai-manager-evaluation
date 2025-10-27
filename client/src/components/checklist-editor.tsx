import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Checklist,
  ChecklistItem,
  ChecklistItemType,
} from "@/lib/rest";

interface ChecklistEditorProps {
  checklist: Checklist | null;
  onClose: () => void;
  onSave: (checklist: Checklist) => void;
}

export function ChecklistEditor({ checklist, onClose, onSave }: ChecklistEditorProps) {
  const [name, setName] = useState(checklist?.name || "");
  const [version, setVersion] = useState(checklist?.version || "1.0");
  const [items, setItems] = useState<ChecklistItem[]>(checklist?.items || []);

  const handleAddItem = () => {
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      title: "",
      type: "mandatory",
      criteria: {
        positive_patterns: [],
        negative_patterns: [],
        llm_hint: "",
      },
      confidence_threshold: 0.6,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<ChecklistItem>) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Укажите название чек-листа");
      return;
    }

    if (items.length === 0) {
      alert("Добавьте хотя бы один пункт");
      return;
    }

    const newChecklist: Checklist = {
      id: checklist?.id || `checklist-${Date.now()}`,
      name: name.trim(),
      version,
      items,
    };

    onSave(newChecklist);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {checklist ? "Редактировать чек-лист" : "Создать чек-лист"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Продажи B2B"
                data-testid="input-checklist-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Версия</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                data-testid="input-checklist-version"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Пункты чек-листа</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить пункт
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border border-card-border space-y-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Пункт {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveItem(item.id)}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { title: e.target.value })
                        }
                        placeholder="Приветствие и представление"
                        data-testid={`input-item-title-${index}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Тип</Label>
                      <Select
                        value={item.type}
                        onValueChange={(value: ChecklistItemType) =>
                          handleUpdateItem(item.id, { type: value })
                        }
                      >
                        <SelectTrigger data-testid={`select-item-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mandatory">Обязательный</SelectItem>
                          <SelectItem value="recommended">Рекомендуемый</SelectItem>
                          <SelectItem value="prohibited">Запрещённый</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Критерий для LLM</Label>
                      <Textarea
                        value={item.criteria.llm_hint}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            criteria: { ...item.criteria, llm_hint: e.target.value },
                          })
                        }
                        placeholder="Описание, что именно проверять..."
                        className="resize-none"
                        rows={2}
                        data-testid={`textarea-item-hint-${index}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Ключевые фразы (через запятую, опционально)</Label>
                      <Input
                        value={item.criteria.positive_patterns?.join(", ") || ""}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            criteria: {
                              ...item.criteria,
                              positive_patterns: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        placeholder="добрый день, здравствуйте, меня зовут"
                        data-testid={`input-item-patterns-${index}`}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Нажмите "Добавить пункт" для создания первого пункта
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-checklist">
              Отмена
            </Button>
            <Button onClick={handleSave} data-testid="button-save-checklist">
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
