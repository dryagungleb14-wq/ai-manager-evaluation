import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface TranscriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TranscriptEditor({ value, onChange }: TranscriptEditorProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium">Расшифровка</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
