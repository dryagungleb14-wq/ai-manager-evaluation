import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  FileText,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AnalysisReport, ChecklistItemStatus } from "@/lib/rest";

interface AnalysisResultsProps {
  report: AnalysisReport & { id?: string };
}

export function AnalysisResults({ report }: AnalysisResultsProps) {
  const { checklistReport, objectionsReport, id: analysisId } = report;

  const handleDownloadMarkdown = () => {
    if (!analysisId) {
      console.error("No analysis ID available for download");
      return;
    }
    
    const url = `/api/analyses/${analysisId}/markdown`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${analysisId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    if (!analysisId) {
      console.error("No analysis ID available for download");
      return;
    }
    
    const url = `/api/analyses/${analysisId}/pdf`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${analysisId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusIcon = (status: ChecklistItemStatus) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-5 w-5 text-chart-2" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "uncertain":
        return <HelpCircle className="h-5 w-5 text-chart-4" />;
    }
  };

  const getStatusBadge = (status: ChecklistItemStatus) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-chart-2 hover:bg-chart-2/80">Выполнен</Badge>;
      case "failed":
        return <Badge variant="destructive">Не выполнен</Badge>;
      case "uncertain":
        return <Badge className="bg-chart-4 hover:bg-chart-4/80">Сомнительно</Badge>;
    }
  };

  const getHandlingBadge = (handling: string) => {
    switch (handling) {
      case "handled":
        return <Badge className="bg-chart-2 hover:bg-chart-2/80">Обработано</Badge>;
      case "partial":
        return <Badge className="bg-chart-4 hover:bg-chart-4/80">Частично</Badge>;
      case "unhandled":
        return <Badge variant="destructive">Не обработано</Badge>;
      default:
        return <Badge variant="secondary">{handling}</Badge>;
    }
  };

  const passedCount = checklistReport.items.filter(
    (item) => item.status === "passed"
  ).length;
  const totalCount = checklistReport.items.length;
  const passPercentage = (passedCount / totalCount) * 100;

  return (
    <div className="space-y-6" data-testid="analysis-results">
      {/* Download Buttons */}
      {analysisId && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadMarkdown}
            data-testid="button-download-markdown"
          >
            <Download className="h-4 w-4" />
            Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadPDF}
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      )}

      {/* Отчёт по чек-листу */}
      <Card className="shadow-lg" data-testid="card-checklist-report">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2" data-testid="title-checklist-report">
                <FileText className="h-6 w-6" />
                Отчёт по чек-листу
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Источник: {checklistReport.meta.source === "call" ? "Звонок" : "Переписка"}
                {" • "}
                {new Date(checklistReport.meta.analyzed_at).toLocaleString("ru")}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{Math.round(passPercentage)}%</div>
              <div className="text-sm text-muted-foreground">
                {passedCount} из {totalCount}
              </div>
            </div>
          </div>
          <Progress value={passPercentage} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm leading-relaxed">{checklistReport.summary}</p>
          </div>

          <Accordion type="multiple" className="w-full">
            {checklistReport.items.map((item, index) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left w-full">
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Уверенность: {Math.round(item.score * 100)}%
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {item.comment && (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-sm">{item.comment}</p>
                      </div>
                    )}
                    {item.evidence.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Цитаты из диалога:</p>
                        {item.evidence.map((evidence, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border-l-4 border-primary bg-primary/5"
                            data-testid={`evidence-${index}-${idx}`}
                          >
                            <p className="text-sm font-mono">{evidence.text}</p>
                            {evidence.start !== undefined && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Таймкод: {formatTimecode(evidence.start)}
                                {evidence.end && ` - ${formatTimecode(evidence.end)}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Отчёт по возражениям и содержанию */}
      <Card className="shadow-lg" data-testid="card-objections-report">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2" data-testid="title-objections-report">
            <MessageSquare className="h-6 w-6" />
            Отчёт по возражениям и содержанию
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Суть разговора */}
          <div className="space-y-2" data-testid="section-essence">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Суть разговора</h3>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="leading-relaxed" data-testid="text-conversation-essence">{objectionsReport.conversation_essence}</p>
            </div>
          </div>

          <Separator />

          {/* Итог */}
          <div className="space-y-2" data-testid="section-outcome">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
              <h3 className="font-semibold">Итог и следующие шаги</h3>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="leading-relaxed" data-testid="text-outcome">{objectionsReport.outcome}</p>
            </div>
          </div>

          <Separator />

          {/* Ключевые темы */}
          {objectionsReport.topics.length > 0 && (
            <div className="space-y-2" data-testid="section-topics">
              <h3 className="font-semibold">Ключевые темы</h3>
              <div className="flex flex-wrap gap-2">
                {objectionsReport.topics.map((topic, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm" data-testid={`badge-topic-${idx}`}>
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Возражения */}
          <div className="space-y-3" data-testid="section-objections">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-chart-4" />
              <h3 className="font-semibold">
                Возражения ({objectionsReport.objections.length})
              </h3>
            </div>

            {objectionsReport.objections.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground" data-testid="text-no-objections">
                Возражений не обнаружено
              </div>
            ) : (
              <div className="space-y-3">
                {objectionsReport.objections.map((objection, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-card-border space-y-3"
                    data-testid={`objection-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline">{objection.category}</Badge>
                      {getHandlingBadge(objection.handling)}
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Клиент:</p>
                        <p className="text-sm font-mono bg-muted/30 p-2 rounded">
                          {objection.client_phrase}
                        </p>
                      </div>

                      {objection.manager_reply && (
                        <div>
                          <p className="text-sm font-medium mb-1">Ответ менеджера:</p>
                          <p className="text-sm font-mono bg-muted/30 p-2 rounded">
                            {objection.manager_reply}
                          </p>
                        </div>
                      )}

                      {objection.advice && (
                        <div className="p-3 rounded-lg bg-primary/5 border-l-4 border-primary">
                          <p className="text-sm">
                            <span className="font-medium">Рекомендация:</span>{" "}
                            {objection.advice}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
