import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, FileText, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checklist } from "@shared/schema";
import { buildApiUrl } from "@/lib/apiBase";

interface ChecklistUploadProps {
  onChecklistCreated: (checklist: Checklist) => void;
}

export function ChecklistUpload({ onChecklistCreated }: ChecklistUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(buildApiUrl("/api/checklists/upload"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `Ошибка загрузки (${response.status})`,
        }));
        throw new Error(errorData.error || `Ошибка при обработке файла (${response.status})`);
      }

      const checklist = await response.json();
      onChecklistCreated(checklist);
      setSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setFileName(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsUploading(false);
    }
  }, [onChecklistCreated]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={`
          min-h-48 flex flex-col items-center justify-center p-6 border-2 border-dashed cursor-pointer
          transition-colors duration-200
          ${isDragActive ? "border-primary bg-primary/5" : "border-border hover-elevate"}
          ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
          ${success ? "border-green-500 bg-green-500/5" : ""}
        `}
        data-testid="dropzone-checklist"
      >
        <input {...getInputProps()} data-testid="input-checklist-file" />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Обработка файла...</p>
              {fileName && (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              )}
            </div>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-green-500">Чек-лист успешно создан!</p>
              {fileName && (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            {isDragActive ? (
              <>
                <Upload className="h-10 w-10 text-primary" />
                <p className="text-base font-medium">Отпустите файл для загрузки</p>
              </>
            ) : (
              <>
                <FileText className="h-10 w-10 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-base font-medium">
                    Загрузите файл с чек-листом
                  </p>
                  <p className="text-sm text-muted-foreground">
                    AI автоматически распарсит структуру
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>TXT/MD:</strong> AI понимает любой формат</p>
                  <p><strong>CSV/Excel:</strong> Колонки "Пункт", "Тип", "Описание"</p>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
