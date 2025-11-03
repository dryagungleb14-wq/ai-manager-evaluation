import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { CheckCircle2, AlertCircle, XCircle, MinusCircle } from "lucide-react";

export interface CriterionReport {
  id: string;
  number: string;
  title: string;
  description?: string;
  achievedLevel: "max" | "mid" | "min" | null;
  score: number;
  maxScore?: number;
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
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm">
            <strong>Итоговая сводка:</strong> {report.summary}
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Критерий</TableHead>
                <TableHead className="min-w-[200px]">Описание</TableHead>
                <TableHead className="w-[100px] text-center">Балл</TableHead>
                <TableHead className="w-[100px] text-center">Максимум</TableHead>
                <TableHead className="min-w-[250px]">Комментарий</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.stages.map((stage, stageIndex) => {
                const stageScore = stage.criteria.reduce((sum, c) => sum + c.score, 0);
                const stageMaxScore = stage.criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0);

                return (
                  <>
                    <TableRow key={`stage-${stageIndex}`} className="bg-muted/50">
                      <TableCell colSpan={5} className="font-semibold">
                        {stage.stageName}
                      </TableCell>
                    </TableRow>
                    {stage.criteria.map((criterion) => (
                      <TableRow key={criterion.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getLevelIcon(criterion.achievedLevel)}
                            <span>{criterion.number}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {criterion.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {criterion.description || criterion.comment}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getLevelBadgeVariant(criterion.achievedLevel)}>
                            {criterion.score}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {criterion.maxScore || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {criterion.comment}
                          {criterion.evidence.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {criterion.evidence.map((ev, i) => (
                                <div
                                  key={i}
                                  className="text-xs italic border-l-2 pl-2 py-1 bg-muted/50"
                                >
                                  "{ev.text}"
                                  {ev.timestamp && (
                                    <span className="ml-2 text-muted-foreground">
                                      ({ev.timestamp})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="font-semibold text-right">
                        Итого по этапу:
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {stageScore}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {stageMaxScore}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold text-right">
                  ОБЩИЙ БАЛЛ:
                </TableCell>
                <TableCell className="text-center font-bold">
                  {report.totalScore}
                </TableCell>
                <TableCell className="text-center font-bold">
                  {report.maxPossibleScore}
                </TableCell>
                <TableCell className="text-center font-bold">
                  {report.percentage}%
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
