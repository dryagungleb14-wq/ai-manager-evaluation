import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Manager } from "@shared/schema";

interface ManagerSelectorProps {
  onManagerChange: (managerId: string | null) => void;
  selectedManagerId?: string | null;
}

export function ManagerSelector({ onManagerChange, selectedManagerId }: ManagerSelectorProps) {
  const [activeId, setActiveId] = useState<string | null>(selectedManagerId || null);

  const { data: managers = [], isLoading } = useQuery<Manager[]>({
    queryKey: ["/api/managers"],
  });

  useEffect(() => {
    if (selectedManagerId !== activeId) {
      setActiveId(selectedManagerId || null);
    }
  }, [selectedManagerId]);

  const handleSelectChange = (value: string) => {
    const managerId = value === "none" ? null : value;
    setActiveId(managerId);
    onManagerChange(managerId);
  };

  const activeManager = managers.find((m) => m.id === activeId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Выбор менеджера</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Загрузка менеджеров...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Выбор менеджера</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={activeId || "none"} onValueChange={handleSelectChange}>
          <SelectTrigger data-testid="select-manager">
            <SelectValue placeholder="Выберите менеджера" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" data-testid="select-manager-none">
              Не указан
            </SelectItem>
            {managers.map((manager) => (
              <SelectItem
                key={manager.id}
                value={manager.id}
                data-testid={`select-manager-${manager.id}`}
              >
                {manager.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeManager && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{activeManager.name}</span>
              <Badge variant="outline" className="text-xs">
                {activeManager.department}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Телефон: {activeManager.phone}</div>
              <div>Email: {activeManager.email}</div>
              <div>Руководитель: {activeManager.teamLead}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
