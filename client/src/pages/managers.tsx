import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Manager, InsertManager, insertManagerSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

function normalizeOptionalField(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeManagerPayload(payload: InsertManager): InsertManager {
  return {
    name: payload.name.trim(),
    phone: normalizeOptionalField(payload.phone),
    email: normalizeOptionalField(payload.email),
    teamLead: normalizeOptionalField(payload.teamLead),
    department: normalizeOptionalField(payload.department),
  };
}

export default function Managers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const { toast } = useToast();

  const { data: managers = [], isLoading } = useQuery<Manager[]>({
    queryKey: ["/api/managers"],
  });

  const form = useForm<InsertManager>({
    resolver: zodResolver(insertManagerSchema),
    defaultValues: {
      name: "",
      phone: null,
      email: null,
      teamLead: null,
      department: null,
    },
  });

  const createMutation = useMutation<Manager, Error, InsertManager>({
    mutationFn: (manager: InsertManager) =>
      apiRequest<Manager>("POST", "/api/managers", manager),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Успех",
        description: "Менеджер создан",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<
    Manager,
    Error,
    { id: string; data: InsertManager }
  >({
    mutationFn: ({ id, data }) =>
      apiRequest<Manager>("PUT", `/api/managers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setDialogOpen(false);
      setEditingManager(null);
      form.reset();
      toast({
        title: "Успех",
        description: "Менеджер обновлён",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => apiRequest<void>("DELETE", `/api/managers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      toast({
        title: "Успех",
        description: "Менеджер удалён",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertManager) => {
    const normalized = normalizeManagerPayload(data);

    if (editingManager) {
      updateMutation.mutate({ id: editingManager.id, data: normalized });
    } else {
      createMutation.mutate(normalized);
    }
  };

  const handleEdit = (manager: Manager) => {
    setEditingManager(manager);
    form.reset({
      name: manager.name,
      phone: manager.phone ?? null,
      email: manager.email ?? null,
      teamLead: manager.teamLead ?? null,
      department: manager.department ?? null,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены что хотите удалить этого менеджера?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingManager(null);
      form.reset();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Управление менеджерами</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="container py-8 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Список менеджеров</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-create-manager">
                    <Plus className="h-4 w-4" />
                    Добавить менеджера
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingManager ? "Редактировать менеджера" : "Новый менеджер"}
                    </DialogTitle>
                    <DialogDescription>
                      Заполните информацию о менеджере
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ФИО</FormLabel>
                            <FormControl>
                              <Input placeholder="Иван Иванов" {...field} data-testid="input-manager-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Телефон</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="+7 (999) 123-45-67"
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-manager-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="ivan@company.ru"
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-manager-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="teamLead"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Руководитель</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Петров П.П."
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-manager-teamlead"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Отдел</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Продажи B2B"
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-manager-department"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          data-testid="button-submit-manager"
                        >
                          {editingManager ? "Сохранить" : "Создать"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Загрузка менеджеров...
              </div>
            ) : managers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет менеджеров. Создайте первого менеджера.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Отдел</TableHead>
                    <TableHead>Руководитель</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.map((manager) => (
                    <TableRow key={manager.id} data-testid={`row-manager-${manager.id}`}>
                      <TableCell className="font-medium">{manager.name}</TableCell>
                      <TableCell>{manager.phone}</TableCell>
                      <TableCell>{manager.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{manager.department}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{manager.teamLead}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(manager)}
                            data-testid={`button-edit-${manager.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(manager.id)}
                            data-testid={`button-delete-${manager.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
