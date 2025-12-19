import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useVoiceOrdering } from "../../hooks/useVoiceOrdering";
import { useAIStore } from "../../stores/aiStore";
import { Card, CardContent } from "../ui/card";

export function VoiceOrderingButton() {
  const { isSupported, isListening, transcript, toggleListening } =
    useVoiceOrdering();
  const lastCommand = useAIStore((state) => state.lastCommand);
  const isProcessing = useAIStore((state) => state.isProcessing);

  if (!isSupported) {
    return (
      <Badge variant="destructive">Voice ordering not supported</Badge>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant={isListening ? "destructive" : "default"}
        size="xl"
        onClick={toggleListening}
        className="w-full"
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : isListening ? (
          <>
            <MicOff className="mr-2 h-5 w-5" />
            Stop Listening
          </>
        ) : (
          <>
            <Mic className="mr-2 h-5 w-5" />
            Start Voice Order
          </>
        )}
      </Button>

      {isListening && transcript && (
        <Card className="animate-pulse">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Listening...</p>
            <p className="text-base font-medium">{transcript}</p>
          </CardContent>
        </Card>
      )}

      {lastCommand && !isListening && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Last command:</p>
            <p className="text-sm font-medium">{lastCommand}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

