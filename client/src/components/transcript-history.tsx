import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, FileText, Globe } from "lucide-react";
import { buildApiUrl } from "@/lib/apiBase";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface Transcript {
  id: number;
  text: string;
  source: "call" | "correspondence";
  language: string;
  audioFileName: string | null;
  duration: number | null;
  createdAt: string;
}

interface TranscriptHistoryProps {
  onTranscriptSelect: (transcript: Transcript) => void;
}

export function TranscriptHistory({ onTranscriptSelect }: TranscriptHistoryProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTranscripts();
  }, []);

  const loadTranscripts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl("/api/transcripts"), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load transcripts");
      }

      const data = await response.json();
      setTranscripts(data);
    } catch (error) {
      console.error("Error loading transcripts:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить историю транскриптов",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "—";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getSourceLabel = (source: string): string => {
    return source === "call" ? "Звонок" : "Переписка";
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Загрузка...
        </div>
      </Card>
    );
  }

  if (transcripts.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <FileText className="mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Нет сохранённых транскриптов</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Последние транскрипты</h3>
        <span className="text-xs text-muted-foreground">{transcripts.length} из 5</span>
      </div>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {transcripts.map((transcript) => (
            <button
              key={transcript.id}
              onClick={() => onTranscriptSelect(transcript)}
              className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium">{getSourceLabel(transcript.source)}</span>
                  </div>
                  <p className="text-sm line-clamp-2 text-muted-foreground mb-2">
                    {transcript.text}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(transcript.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </span>
                    </div>
                    {transcript.duration && (
                      <div className="flex items-center gap-1">
                        <span>⏱</span>
                        <span>{formatDuration(transcript.duration)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{transcript.language.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
