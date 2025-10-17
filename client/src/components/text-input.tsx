import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ value, onChange }: TextInputProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      onChange(text);
    } catch (err) {
      console.error("Ошибка чтения файла:", err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "text/plain") {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="text-input" className="text-base font-medium">
          Текст переписки
        </Label>
        <div className="relative">
          <input
            type="file"
            id="file-upload"
            accept=".txt,.md"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-text-file"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("file-upload")?.click()}
            data-testid="button-upload-text"
          >
            <Upload className="h-4 w-4 mr-2" />
            Загрузить .txt
          </Button>
        </div>
      </div>

      <Card
        className={`
          relative transition-colors duration-200
          ${dragActive ? "border-primary bg-primary/5" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Textarea
          id="text-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Вставьте текст переписки или перетащите .txt файл..."
          className="min-h-[400px] resize-none border-0 focus-visible:ring-0 font-mono text-sm leading-relaxed"
          data-testid="textarea-correspondence"
        />
        
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Введите или вставьте текст переписки</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
