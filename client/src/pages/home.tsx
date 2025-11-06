import { Suspense, lazy, useState, useCallback } from "react";
import { Phone, MessageCircle, Sparkles, History, Users } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserInfo } from "@/components/user-info";
import { AnalysisReport, AdvancedChecklistReport } from "@/lib/rest";
import { buildApiUrl } from "@/lib/apiBase";
import type { AnyChecklist } from "@/components/checklist-selector";

const AudioUpload = lazy(() =>
  import("@/components/audio-upload").then((module) => ({
    default: module.AudioUpload,
  }))
);

const TextInput = lazy(() =>
  import("@/components/text-input").then((module) => ({
    default: module.TextInput,
  }))
);

const TranscriptEditor = lazy(() =>
  import("@/components/transcript-editor").then((module) => ({
    default: module.TranscriptEditor,
  }))
);

const ChecklistSelector = lazy(() =>
  import("@/components/checklist-selector").then((module) => ({
    default: module.ChecklistSelector,
  }))
);

const AnalysisResults = lazy(() =>
  import("@/components/analysis-results").then((module) => ({
    default: module.AnalysisResults,
  }))
);

const AdvancedChecklistResults = lazy(() =>
  import("@/components/advanced-checklist-results").then((module) => ({
    default: module.AdvancedChecklistResults,
  }))
);

const TranscriptHistory = lazy(() =>
  import("@/components/transcript-history").then((module) => ({
    default: module.TranscriptHistory,
  }))
);

interface SavedTranscript {
  id: number;
  text: string;
  source: "call" | "correspondence";
  language: string;
  audioFileName: string | null;
  duration: number | null;
  createdAt: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"call" | "correspondence">("call");
  const [transcript, setTranscript] = useState("");
  const [correspondenceText, setCorrespondenceText] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<AnyChecklist | null>(null);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | AdvancedChecklistReport | null>(null);
  const [currentTranscriptId, setCurrentTranscriptId] = useState<string | null>(null);
  const [isFromHistory, setIsFromHistory] = useState(false);
  const { toast } = useToast();

  // Сброс отчёта при загрузке нового контента
  const handleResetAnalysis = useCallback(() => {
    setAnalysisReport(null);
  }, []);

  // Memoize the callback to prevent unnecessary re-renders of ChecklistSelector
  const handleChecklistChange = useCallback((checklist: AnyChecklist) => {
    setActiveChecklist(checklist);
  }, []);

  // Handle selecting a transcript from history
  const handleTranscriptSelect = useCallback((savedTranscript: SavedTranscript) => {
    // Set the transcript text
    if (savedTranscript.source === "call") {
      setTranscript(savedTranscript.text);
      setActiveTab("call");
    } else {
      setCorrespondenceText(savedTranscript.text);
      setActiveTab("correspondence");
    }
    
    // Store the transcript ID for re-evaluation
    setCurrentTranscriptId(savedTranscript.id.toString());
    setIsFromHistory(true);
    
    // Reset analysis when loading a saved transcript
    setAnalysisReport(null);
    
    toast({
      title: "Транскрипт загружен",
      description: "Теперь вы можете провести анализ по чек-листу",
    });
  }, [toast]);

  // Handle new transcript from audio upload
  const handleNewTranscriptId = useCallback((transcriptId: string) => {
    setCurrentTranscriptId(transcriptId);
    setIsFromHistory(false);
  }, []);

  // Reset transcript selection when starting new upload
  const handleUploadStart = useCallback(() => {
    handleResetAnalysis();
    setCurrentTranscriptId(null);
    setIsFromHistory(false);
  }, [handleResetAnalysis]);

  const handleAnalyze = async () => {
    if (!activeChecklist) {
      toast({
        title: "Ошибка",
        description: "Выберите чек-лист для анализа",
        variant: "destructive",
      });
      return;
    }

    const textToAnalyze = activeTab === "call" ? transcript : correspondenceText;
    
    if (!textToAnalyze.trim()) {
      toast({
        title: "Ошибка",
        description: "Нет текста для анализа",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisReport(null);

    try {
      const isAdvanced = activeChecklist.type === "advanced";
      
      if (isAdvanced) {
        const requestPayload = {
          transcript: textToAnalyze,
          checklistId: activeChecklist.id,
          language: "ru",
          source: activeTab,
          transcriptId: currentTranscriptId,
        };

        const response = await fetch(buildApiUrl("/api/advanced-checklists/analyze"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Ошибка анализа" }));
          throw new Error(errorData.error || "Ошибка при анализе");
        }

        const data = await response.json();
        setAnalysisReport(data);
      } else {
        const requestPayload = {
          transcript: textToAnalyze,
          checklist: activeChecklist,
          language: "ru",
          source: activeTab,
          transcriptId: currentTranscriptId,
        };

        const response = await fetch(buildApiUrl("/api/analyze"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Ошибка анализа" }));
          throw new Error(errorData.error || "Ошибка при анализе");
        }

        const data = await response.json();
        setAnalysisReport(data);
      }
      
      toast({
        title: "Анализ завершён",
        description: "Результаты готовы к просмотру",
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Произошла ошибка при анализе",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasTextToAnalyze = activeTab === "call" ? transcript.trim() : correspondenceText.trim();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">AI Оценка Менеджеров</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/managers">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-view-managers">
                <Users className="h-4 w-4" />
                Менеджеры
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-view-history">
                <History className="h-4 w-4" />
                История
              </Button>
            </Link>
            <ThemeToggle />
            <UserInfo />
          </div>
        </div>
      </header>

      <div className="container py-8 px-4">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Content */}
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v as "call" | "correspondence");
              handleResetAnalysis();
            }}>
              <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-mode">
                <TabsTrigger value="call" className="gap-2" data-testid="tab-call">
                  <Phone className="h-4 w-4" />
                  Звонок
                </TabsTrigger>
                <TabsTrigger value="correspondence" className="gap-2" data-testid="tab-correspondence">
                  <MessageCircle className="h-4 w-4" />
                  Переписка
                </TabsTrigger>
              </TabsList>

              <TabsContent value="call" className="space-y-6 mt-6">
                <Suspense
                  fallback={
                    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                      Загрузка загрузчика аудио...
                    </div>
                  }
                >
                  <AudioUpload
                    onTranscript={setTranscript}
                    onTranscriptId={handleNewTranscriptId}
                    isProcessing={isProcessingAudio}
                    setIsProcessing={setIsProcessingAudio}
                    onUploadStart={handleUploadStart}
                  />
                </Suspense>

                {transcript && (
                  <Suspense
                    fallback={
                      <Card className="p-6 text-center text-muted-foreground">
                        Загрузка редактора транскрипта...
                      </Card>
                    }
                  >
                    <TranscriptEditor value={transcript} onChange={setTranscript} />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="correspondence" className="space-y-6 mt-6">
                <Suspense
                  fallback={
                    <Card className="p-6 text-center text-muted-foreground">
                      Загрузка текстовой формы...
                    </Card>
                  }
                >
                  <TextInput value={correspondenceText} onChange={setCorrespondenceText} />
                </Suspense>
              </TabsContent>
            </Tabs>

            {hasTextToAnalyze && !analysisReport && (
              <Card className="p-6">
                {isFromHistory && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <History className="h-4 w-4" />
                    <span>Используется сохранённый транскрипт</span>
                  </div>
                )}
                <Button
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !activeChecklist}
                  className="w-full"
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                      Анализ в процессе...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Проверить по чек-листу
                    </>
                  )}
                </Button>
              </Card>
            )}

            {analysisReport && (
              <Suspense
                fallback={
                  <Card className="p-6 text-center text-muted-foreground">
                    Загрузка результатов анализа...
                  </Card>
                }
              >
                {"stages" in analysisReport ? (
                  <AdvancedChecklistResults report={analysisReport} />
                ) : (
                  <AnalysisResults report={analysisReport} />
                )}
              </Suspense>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <Suspense
              fallback={
                <Card className="p-6 text-center text-muted-foreground">
                  Загрузка чек-листов...
                </Card>
              }
            >
              <ChecklistSelector onChecklistChange={handleChecklistChange} />
            </Suspense>
            
            <Suspense
              fallback={
                <Card className="p-6 text-center text-muted-foreground">
                  Загрузка истории транскриптов...
                </Card>
              }
            >
              <TranscriptHistory onTranscriptSelect={handleTranscriptSelect} />
            </Suspense>
          </aside>
        </div>
      </div>
    </div>
  );
}
