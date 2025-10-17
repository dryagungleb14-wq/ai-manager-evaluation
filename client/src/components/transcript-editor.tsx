import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronDown, FileText } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TranscriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TranscriptEditor({ value, onChange }: TranscriptEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between hover-elevate"
          data-testid="button-toggle-transcript"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Расшифровка звонка</span>
            <span className="text-xs text-muted-foreground">
              ({value.length} символов)
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        <Label htmlFor="transcript" className="text-sm text-muted-foreground">
          Вы можете отредактировать текст перед анализом
        </Label>
        <Textarea
          id="transcript"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[300px] font-mono text-sm leading-relaxed resize-none"
          data-testid="textarea-transcript"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
