import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, MessageSquare, Calendar } from "lucide-react";
import { AnalysisResults } from "@/components/analysis-results";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalysisReport } from "@shared/schema";

interface AnalysisDetailResponse extends AnalysisReport {
  id: string;
}

interface AnalysisMetadata {
  id: string;
  source: "call" | "correspondence";
  language: string;
  analyzedAt: string;
  transcript: string;
}

export default function AnalysisDetail() {
  const [, params] = useRoute("/history/:id");
  const analysisId = params?.id;

  const { data: analysis, isLoading } = useQuery<AnalysisDetailResponse>({
    queryKey: ["/api/analyses", analysisId],
    enabled: !!analysisId,
  });

  const { data: metadata } = useQuery<AnalysisMetadata>({
    queryKey: ["/api/analyses", analysisId, "metadata"],
    queryFn: async () => {
      const res = await fetch(`/api/analyses/${analysisId}`);
      if (!res.ok) throw new Error("Failed to fetch metadata");
      const data = await res.json();
      return {
        id: analysisId!,
        source: data.checklistReport?.meta?.source || "call",
        language: data.checklistReport?.meta?.language || "ru",
        analyzedAt: data.checklistReport?.meta?.analyzed_at || new Date().toISOString(),
        transcript: "",
      };
    },
    enabled: !!analysisId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <Link href="/history">
            <Button variant="outline" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Назад к истории
            </Button>
          </Link>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-xl font-semibold mb-2">Анализ не найден</h3>
              <p className="text-muted-foreground">
                Запрошенный анализ не существует или был удалён
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const analyzedDate = metadata?.analyzedAt
    ? new Date(metadata.analyzedAt)
    : new Date();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/history">
            <Button variant="outline" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Назад к истории
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 text-muted-foreground">
          {metadata?.source === "call" ? (
            <FileText className="h-5 w-5" />
          ) : (
            <MessageSquare className="h-5 w-5" />
          )}
          <span className="font-medium">
            {metadata?.source === "call" ? "Звонок" : "Переписка"}
          </span>
          <span>•</span>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{analyzedDate.toLocaleString("ru")}</span>
          </div>
        </div>

        <AnalysisResults report={analysis} />
      </div>
    </div>
  );
}
