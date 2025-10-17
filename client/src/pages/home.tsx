import { useState } from "react";
import { Phone, MessageCircle, Sparkles, History } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AudioUpload } from "@/components/audio-upload";
import { TextInput } from "@/components/text-input";
import { TranscriptEditor } from "@/components/transcript-editor";
import { ChecklistSelector } from "@/components/checklist-selector";
import { AnalysisResults } from "@/components/analysis-results";
import { ThemeToggle } from "@/components/theme-toggle";
import { Checklist, AnalysisReport } from "@shared/schema";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"call" | "correspondence">("call");
  const [transcript, setTranscript] = useState("");
  const [correspondenceText, setCorrespondenceText] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const { toast } = useToast();

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
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToAnalyze,
          checklist: activeChecklist,
          language: "ru",
          source: activeTab,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Ошибка анализа" }));
        throw new Error(errorData.error || "Ошибка при анализе");
      }

      const data = await response.json();
      setAnalysisReport(data);
      
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
            <Link href="/history">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-view-history">
                <History className="h-4 w-4" />
                История
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container py-8 px-4">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Content */}
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "call" | "correspondence")}>
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
                <AudioUpload
                  onTranscript={setTranscript}
                  isProcessing={isProcessingAudio}
                  setIsProcessing={setIsProcessingAudio}
                />
                
                {transcript && (
                  <TranscriptEditor value={transcript} onChange={setTranscript} />
                )}
              </TabsContent>

              <TabsContent value="correspondence" className="space-y-6 mt-6">
                <TextInput value={correspondenceText} onChange={setCorrespondenceText} />
              </TabsContent>
            </Tabs>

            {hasTextToAnalyze && !analysisReport && (
              <Card className="p-6">
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

            {analysisReport && <AnalysisResults report={analysisReport} />}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <ChecklistSelector onChecklistChange={setActiveChecklist} />
          </aside>
        </div>
      </div>
    </div>
  );
}
