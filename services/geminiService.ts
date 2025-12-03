import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, Blob } from '@google/genai';
import { MENU, SYSTEM_INSTRUCTION } from '../constants';
import { MenuItem } from '../types';

// -- Audio Utilities --
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// -- Tool Definitions --

const showDishFunction: FunctionDeclaration = {
  name: 'showDish',
  description: 'Display a specific dish details on the screen. Use this when user asks about a specific item or you recommend one.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dishId: { type: Type.STRING, description: 'The ID of the dish to display' }
    },
    required: ['dishId']
  }
};

const filterMenuFunction: FunctionDeclaration = {
  name: 'filterMenu',
  description: 'Filter the menu based on criteria (e.g. spicy, vegan, cheap) and show the list.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tag: { type: Type.STRING, description: 'The tag to filter by (e.g., spicy, vegan)' },
      maxPrice: { type: Type.NUMBER, description: 'Maximum price limit' }
    }
  }
};

const addToCartFunction: FunctionDeclaration = {
  name: 'addToCart',
  description: 'Add a specific dish to the shopping cart.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dishId: { type: Type.STRING, description: 'The ID of the dish' },
      quantity: { type: Type.NUMBER, description: 'Quantity to add' }
    },
    required: ['dishId', 'quantity']
  }
};

const goToCheckoutFunction: FunctionDeclaration = {
  name: 'goToCheckout',
  description: 'Navigate to the checkout screen to complete the order.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const goToHomeFunction: FunctionDeclaration = {
    name: 'goToHome',
    description: 'Navigate back to the main menu list.',
    parameters: { type: Type.OBJECT, properties: {} }
};


// -- Service Class --

type UIHandlers = {
  onShowDish: (dish: MenuItem) => void;
  onFilterMenu: (tag?: string, maxPrice?: number) => void;
  onAddToCart: (dish: MenuItem, quantity: number) => void;
  onCheckout: () => void;
  onHome: () => void;
  onTranscriptUpdate: (user: string, model: string) => void;
  onAudioData: (frequencyData: Uint8Array) => void;
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private handlers: UIHandlers;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private analyser: AnalyserNode | null = null;

  constructor(handlers: UIHandlers) {
    this.handlers = handlers;
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async start() {
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Setup Analyser for visualization
    this.analyser = this.inputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    // Start visualization loop
    this.visualize();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log('Gemini Live Connected');
          if (!this.inputAudioContext) return;
          
          const source = this.inputAudioContext.createMediaStreamSource(stream);
          source.connect(this.analyser!); // Connect to visualiser
          
          const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            this.sessionPromise?.then(session => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          
          source.connect(scriptProcessor);
          scriptProcessor.connect(this.inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message);
        },
        onclose: () => console.log('Gemini Live Closed'),
        onerror: (err) => console.error('Gemini Live Error', err)
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseModalities: [Modality.AUDIO],
        tools: [{
          functionDeclarations: [
            showDishFunction, 
            filterMenuFunction, 
            addToCartFunction, 
            goToCheckoutFunction, 
            goToHomeFunction
          ]
        }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    });
  }

  private visualize() {
    if (!this.analyser) return;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
        if (!this.analyser) return;
        requestAnimationFrame(draw);
        this.analyser.getByteFrequencyData(dataArray);
        this.handlers.onAudioData(dataArray);
    }
    draw();
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcripts
    if (message.serverContent?.inputTranscription?.text) {
        this.handlers.onTranscriptUpdate(message.serverContent.inputTranscription.text, '');
    }
    if (message.serverContent?.outputTranscription?.text) {
        this.handlers.onTranscriptUpdate('', message.serverContent.outputTranscription.text);
    }

    // Handle Tool Calls
    if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
            console.log('Function Call:', fc.name, fc.args);
            let result: any = { result: "ok" };

            try {
                if (fc.name === 'showDish') {
                    const dish = MENU.find(d => d.id === fc.args.dishId);
                    if (dish) this.handlers.onShowDish(dish);
                    else result = { error: "Dish not found" };
                } 
                else if (fc.name === 'filterMenu') {
                    this.handlers.onFilterMenu(fc.args.tag as string, fc.args.maxPrice as number);
                }
                else if (fc.name === 'addToCart') {
                    const dish = MENU.find(d => d.id === fc.args.dishId);
                    if (dish) this.handlers.onAddToCart(dish, fc.args.quantity as number || 1);
                }
                else if (fc.name === 'goToCheckout') {
                    this.handlers.onCheckout();
                }
                else if (fc.name === 'goToHome') {
                    this.handlers.onHome();
                }
            } catch (e) {
                console.error("Error executing tool", e);
                result = { error: "Failed to execute" };
            }
            
            this.sessionPromise?.then(session => {
                session.sendToolResponse({
                    functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: result
                    }
                });
            });
        }
    }

    // Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            this.outputAudioContext,
            24000,
            1
        );
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
        source.onended = () => this.sources.delete(source);
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
        this.sources.forEach(s => s.stop());
        this.sources.clear();
        this.nextStartTime = 0;
    }
  }

  async stop() {
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
  }
}