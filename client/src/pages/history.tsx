import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History as HistoryIcon,
  Calendar,
  FileText,
  MessageSquare,
  ChevronRight,
  Loader2,
  Home as HomeIcon,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserInfo } from "@/components/user-info";

interface AnalysisHistoryItem {
  id: string;
  checklistId?: string;
  source: "call" | "correspondence";
  language: string;
  transcript: string;
  analyzedAt: string;
  checklistReport: {
    meta: {
      source: string;
      language: string;
      analyzed_at: string;
    };
    items: Array<{
      status: "passed" | "failed" | "uncertain";
    }>;
    summary: string;
  };
  objectionsReport: {
    topics: string[];
    objections: Array<any>;
    conversation_essence: string;
    outcome: string;
  };
}

export default function History() {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data: analyses = [], isLoading } = useQuery<AnalysisHistoryItem[]>({
    queryKey: ["/api/analyses"],
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => apiRequest<void>("DELETE", `/api/analyses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      toast({
        title: "Готово",
        description: "Анализ удалён",
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

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить этот анализ?")) {
      setDeletingId(id);
      deleteMutation.mutate(id, {
        onSettled: () => setDeletingId(null),
      });
    }
  };

  const getPassRate = (items: any[]) => {
    const passed = items.filter((item) => item.status === "passed").length;
    return Math.round((passed / items.length) * 100);
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">История анализов</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2">
                <HomeIcon className="h-4 w-4" />
                Главная
              </Button>
            </Link>
            <ThemeToggle />
            <UserInfo />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground mt-2">
              Просмотр всех выполненных анализов звонков и переписок
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HistoryIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2" data-testid="text-no-analyses">
                История пуста
              </h3>
              <p className="text-muted-foreground mb-6">
                Выполните первый анализ, чтобы увидеть результаты здесь
              </p>
              <Link href="/">
                <Button data-testid="button-start-analysis">
                  Начать анализ
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => {
              const passRate = getPassRate(analysis.checklistReport.items);
              const analyzedDate = new Date(analysis.analyzedAt);
              const relativeTime = formatDistanceToNow(analyzedDate, {
                addSuffix: true,
                locale: ru,
              });

              return (
                <Card key={analysis.id} className="hover-elevate" data-testid={`card-analysis-${analysis.id}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {analysis.source === "call" ? (
                            <FileText className="h-5 w-5 text-primary" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-primary" />
                          )}
                          <CardTitle className="text-xl" data-testid={`title-analysis-${analysis.id}`}>
                            {analysis.source === "call" ? "Звонок" : "Переписка"}
                          </CardTitle>
                          <Badge variant="secondary" data-testid={`badge-pass-rate-${analysis.id}`}>
                            {passRate}% выполнено
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span data-testid={`text-date-${analysis.id}`}>{relativeTime}</span>
                          <span>•</span>
                          <span>{analyzedDate.toLocaleString("ru")}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{passRate}%</div>
                        <div className="text-sm text-muted-foreground">
                          {analysis.checklistReport.items.filter((i) => i.status === "passed").length} из{" "}
                          {analysis.checklistReport.items.length}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Суть разговора:</h4>
                      <p className="text-sm text-muted-foreground" data-testid={`text-essence-${analysis.id}`}>
                        {truncateText(analysis.objectionsReport.conversation_essence)}
                      </p>
                    </div>

                    {analysis.objectionsReport.topics.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Ключевые темы:</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.objectionsReport.topics.slice(0, 5).map((topic, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {analysis.objectionsReport.topics.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{analysis.objectionsReport.topics.length - 5} ещё
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-muted-foreground">
                        {analysis.objectionsReport.objections.length}{" "}
                        {analysis.objectionsReport.objections.length === 1
                          ? "возражение"
                          : "возражений"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/history/${analysis.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            data-testid={`button-view-${analysis.id}`}
                          >
                            Посмотреть детали
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(analysis.id)}
                          disabled={deleteMutation.isPending && deletingId === analysis.id}
                          data-testid={`button-delete-${analysis.id}`}
                        >
                          {deleteMutation.isPending && deletingId === analysis.id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Удаление...
                            </span>
                          ) : (
                            "Удалить"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
