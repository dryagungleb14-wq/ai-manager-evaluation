import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, AlertCircle, XCircle, MinusCircle } from "lucide-react";

export interface CriterionReport {
  id: string;
  number: string;
  title: string;
  achievedLevel: "max" | "mid" | "min" | null;
  score: number;
  evidence: Array<{ text: string; timestamp?: string }>;
  comment: string;
}

export interface StageReport {
  stageName: string;
  criteria: CriterionReport[];
}

export interface AdvancedChecklistReport {
  checklistId: string;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  stages: StageReport[];
  summary: string;
}

interface AdvancedChecklistResultsProps {
  report: AdvancedChecklistReport;
}

function getLevelIcon(level: "max" | "mid" | "min" | null) {
  switch (level) {
    case "max":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "mid":
      return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    case "min":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <MinusCircle className="h-4 w-4 text-gray-400" />;
  }
}

function getLevelBadgeVariant(level: "max" | "mid" | "min" | null) {
  switch (level) {
    case "max":
      return "default";
    case "mid":
      return "secondary";
    case "min":
      return "destructive";
    default:
      return "outline";
  }
}

export function AdvancedChecklistResults({ report }: AdvancedChecklistResultsProps) {
  const scorePercentage = report.percentage;
  const scoreColor =
    scorePercentage >= 80
      ? "text-green-600"
      : scorePercentage >= 60
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Результаты оценки</span>
          <div className={`text-3xl font-bold ${scoreColor}`}>
            {report.totalScore} / {report.maxPossibleScore}
            <span className="text-lg ml-2 text-muted-foreground">
              ({report.percentage}%)
            </span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm">
            <strong>Итоговая сводка:</strong> {report.summary}
          </p>
        </div>

        {/* Stages */}
        <Accordion type="multiple" className="w-full">
          {report.stages.map((stage, stageIndex) => {
            const stageScore = stage.criteria.reduce((sum, c) => sum + c.score, 0);
            const stageCriteria = stage.criteria.length;

            return (
              <AccordionItem key={stageIndex} value={`stage-${stageIndex}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold text-lg">{stage.stageName}</span>
                    <span className="text-sm text-muted-foreground">
                      {stageCriteria} критериев • {stageScore} баллов
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {stage.criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="p-4 border rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-start gap-2">
                            {getLevelIcon(criterion.achievedLevel)}
                            <div>
                              <span className="font-medium">
                                {criterion.number}
                              </span>
                              <span className="ml-2">{criterion.title}</span>
                            </div>
                          </div>
                          <Badge variant={getLevelBadgeVariant(criterion.achievedLevel)}>
                            {criterion.achievedLevel?.toUpperCase() || "N/A"} •{" "}
                            {criterion.score} баллов
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2 ml-6">
                          {criterion.comment}
                        </p>

                        {criterion.evidence.length > 0 && (
                          <div className="space-y-1 ml-6">
                            <p className="text-xs font-medium">Цитаты:</p>
                            {criterion.evidence.map((ev, i) => (
                              <blockquote
                                key={i}
                                className="text-xs italic border-l-2 pl-2 py-1 bg-muted/50"
                              >
                                "{ev.text}"
                                {ev.timestamp && (
                                  <span className="ml-2 text-muted-foreground">
                                    ({ev.timestamp})
                                  </span>
                                )}
                              </blockquote>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
