import { useEffect, useCallback } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useOrderStore } from "../stores/orderStore";
import { useMenuStore } from "../stores/menuStore";
import { useAIStore } from "../stores/aiStore";
import { MenuItem } from "../types";

export function useVoiceOrdering() {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const addItem = useOrderStore((state) => state.addItem);
  const items = useMenuStore((state) => state.items);
  
  const setIsListening = useAIStore((state) => state.setIsListening);
  const setVoiceTranscript = useAIStore((state) => state.setVoiceTranscript);
  const setLastCommand = useAIStore((state) => state.setLastCommand);
  const setIsProcessing = useAIStore((state) => state.setIsProcessing);

  useEffect(() => {
    setIsListening(listening);
  }, [listening, setIsListening]);

  useEffect(() => {
    setVoiceTranscript(transcript);
  }, [transcript, setVoiceTranscript]);

  const processVoiceCommand = useCallback(
    (command: string) => {
      setIsProcessing(true);
      const lowerCommand = command.toLowerCase();
      
      // Simple pattern matching for menu items
      const foundItems: { item: MenuItem; quantity: number }[] = [];
      
      // Extract quantities (e.g., "two", "three", "2", "3")
      const quantityMap: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      };
      
      // Try to find menu items mentioned in the command
      items.forEach((item) => {
        const itemName = item.name.toLowerCase();
        if (lowerCommand.includes(itemName)) {
          // Check for quantity before the item name
          let quantity = 1;
          const words = lowerCommand.split(" ");
          const itemIndex = words.findIndex((word) => itemName.includes(word));
          
          if (itemIndex > 0) {
            const prevWord = words[itemIndex - 1];
            if (quantityMap[prevWord]) {
              quantity = quantityMap[prevWord];
            } else if (!isNaN(Number(prevWord))) {
              quantity = Number(prevWord);
            }
          }
          
          foundItems.push({ item, quantity });
        }
      });
      
      // Add found items to cart
      foundItems.forEach(({ item, quantity }) => {
        addItem(item, quantity);
      });
      
      if (foundItems.length > 0) {
        setLastCommand(
          `Added: ${foundItems.map((f) => `${f.quantity}x ${f.item.name}`).join(", ")}`
        );
      } else {
        setLastCommand(`Couldn't find items in: "${command}"`);
      }
      
      setIsProcessing(false);
      resetTranscript();
    },
    [items, addItem, resetTranscript, setLastCommand, setIsProcessing]
  );

  const startListening = useCallback(() => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  }, [resetTranscript]);

  const stopListening = useCallback(() => {
    SpeechRecognition.stopListening();
    if (transcript.trim()) {
      processVoiceCommand(transcript);
    }
  }, [transcript, processVoiceCommand]);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  return {
    isSupported: browserSupportsSpeechRecognition,
    isListening: listening,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    processVoiceCommand,
  };
}

