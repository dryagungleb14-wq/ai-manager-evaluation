import { Suspense, lazy, useEffect, useState } from "react";
import { Download, Upload, Copy, FileUp } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checklist, InsertChecklist } from "@/lib/rest";

const ChecklistUpload = lazy(() =>
  import("@/components/checklist-upload").then((module) => ({
    default: module.ChecklistUpload,
  }))
);

interface ChecklistSelectorProps {
  onChecklistChange: (checklist: Checklist) => void;
}

export function ChecklistSelector({ onChecklistChange }: ChecklistSelectorProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch checklists from API
  const { data: checklists = [], isLoading } = useQuery<Checklist[]>({
    queryKey: ["/api/checklists"],
  });

  // Create checklist mutation
  const createChecklistMutation = useMutation<Checklist, Error, InsertChecklist>({
    mutationFn: (checklist: InsertChecklist) =>
      apiRequest<Checklist>("POST", "/api/checklists", checklist),
    onSuccess: (newChecklist) => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklists"] });
      
      // Set the new checklist as active
      setActiveId(newChecklist.id);
      localStorage.setItem("manager-eval-active-checklist", newChecklist.id);
      onChecklistChange(newChecklist);
      
      toast({
        title: "Чек-лист создан",
        description: "Чек-лист успешно сохранён в базе данных",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось создать чек-лист",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (checklists.length > 0 && !activeId) {
      // Get stored active ID from localStorage as fallback
      const storedActive = localStorage.getItem("manager-eval-active-checklist");
      const active = storedActive && checklists.find((c) => c.id === storedActive)
        ? storedActive
        : checklists[0].id;
      
      setActiveId(active);
      localStorage.setItem("manager-eval-active-checklist", active);
      const checklist = checklists.find((c) => c.id === active);
      if (checklist) {
        onChecklistChange(checklist);
      }
    }
  }, [checklists, activeId, onChecklistChange]);

  const handleSelectChange = (value: string) => {
    setActiveId(value);
    localStorage.setItem("manager-eval-active-checklist", value);
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
        
        // Create payload without ID (server will generate it)
        const { id, ...insertPayload } = imported;
        
        // Mutation onSuccess will handle setting active checklist
        await createChecklistMutation.mutateAsync(insertPayload as InsertChecklist);
      } catch (err) {
        console.error("Ошибка импорта:", err);
        toast({
          title: "Ошибка импорта",
          description: "Не удалось импортировать чек-лист",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const handleDuplicate = async () => {
    const checklist = checklists.find((c) => c.id === activeId);
    if (!checklist) return;

    // Create payload without ID (server will generate it)
    const { id, ...baseChecklist } = checklist;
    const duplicatePayload: InsertChecklist = {
      ...baseChecklist,
      name: `${checklist.name} (копия)`,
    };
    
    // Mutation onSuccess will handle setting active checklist
    await createChecklistMutation.mutateAsync(duplicatePayload);
  };

  const handleChecklistUploaded = (checklist: Checklist) => {
    // Invalidate and refetch checklists
    queryClient.invalidateQueries({ queryKey: ["/api/checklists"] });
    
    // Set as active
    setActiveId(checklist.id);
    localStorage.setItem("manager-eval-active-checklist", checklist.id);
    onChecklistChange(checklist);
    
    // Close dialog
    setUploadDialogOpen(false);
    
    toast({
      title: "Чек-лист загружен",
      description: `"${checklist.name}" успешно создан и активирован`,
    });
  };

  const activeChecklist = checklists.find((c) => c.id === activeId);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Чек-лист</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={activeId} onValueChange={handleSelectChange} disabled={isLoading}>
            <SelectTrigger data-testid="select-checklist">
              <SelectValue placeholder={isLoading ? "Загрузка..." : "Выберите чек-лист"} />
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
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  data-testid="button-upload-checklist"
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Загрузить файл
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Загрузить чек-лист из файла</DialogTitle>
                  <DialogDescription>
                    Поддерживаются текстовые (TXT, MD) и табличные (CSV, Excel) форматы.
                    AI автоматически поймёт структуру вашего чек-листа.
                  </DialogDescription>
                </DialogHeader>
                <Suspense
                  fallback={
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Загрузка формы загрузки...
                    </div>
                  }
                >
                  <ChecklistUpload onChecklistCreated={handleChecklistUploaded} />
                </Suspense>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={!activeId || createChecklistMutation.isPending}
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
              disabled={createChecklistMutation.isPending}
              data-testid="button-import-checklist"
            >
              <Upload className="h-4 w-4 mr-2" />
              Импорт JSON
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

    </>
  );
}

