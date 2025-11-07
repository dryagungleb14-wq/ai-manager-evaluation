import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, FileAudio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildApiUrl } from "@/lib/apiBase";

interface AudioUploadProps {
  onTranscript: (transcript: string) => void;
  onTranscriptId?: (transcriptId: string) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  onUploadStart?: () => void;
  onDuplicateTranscript?: (info: {
    transcriptId: string;
    audioFileName?: string | null;
    createdAt?: string | null;
  }) => void;
}

export function AudioUpload({ onTranscript, onTranscriptId, isProcessing, setIsProcessing, onUploadStart, onDuplicateTranscript }: AudioUploadProps) {
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    onUploadStart?.();
    setFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);

      const response = await fetch(buildApiUrl("/api/transcribe"), {
        method: "POST",
        body: formData,
      });

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Ошибка транскрипции" }));
        throw new Error(errorData.error || "Ошибка при обработке аудио");
      }

      const data = await response.json();
      setProgress(90);

      // Формируем текст из сегментов
      let transcriptText = "";
      if (data.transcript?.segments) {
        transcriptText = data.transcript.segments
          .map((seg: any) => seg.text)
          .join(" ");
      } else if (typeof data.transcript === "string") {
        transcriptText = data.transcript;
      }

      onTranscript(transcriptText);
      
      // Pass transcriptId if available
      if (data.transcriptId && onTranscriptId) {
        onTranscriptId(data.transcriptId);
      }

      if (data.reusedTranscript && data.transcriptId && onDuplicateTranscript) {
        onDuplicateTranscript({
          transcriptId: data.transcriptId,
          audioFileName: data.audioFileName ?? null,
          createdAt: data.createdAt ?? null,
        });
      }

      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  }, [onTranscript, onTranscriptId, setIsProcessing, onUploadStart, onDuplicateTranscript]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac"],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={`
          min-h-64 flex flex-col items-center justify-center p-8 border-2 border-dashed cursor-pointer
          transition-colors duration-200
          ${isDragActive ? "border-primary bg-primary/5" : "border-border hover-elevate"}
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
        data-testid="dropzone-audio"
      >
        <input {...getInputProps()} data-testid="input-audio-file" />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="text-center space-y-2 w-full max-w-xs">
              <p className="text-sm font-medium">Обработка аудио...</p>
              {fileName && (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              )}
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            {isDragActive ? (
              <>
                <Upload className="h-12 w-12 text-primary" />
                <p className="text-lg font-medium">Отпустите файл для загрузки</p>
              </>
            ) : (
              <>
                <FileAudio className="h-12 w-12 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    Перетащите аудиофайл сюда
                  </p>
                  <p className="text-sm text-muted-foreground">
                    или нажмите для выбора файла
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Поддерживаются: MP3, WAV, M4A, OGG, FLAC
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {error && (
        <Alert variant="destructive" data-testid="alert-audio-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
