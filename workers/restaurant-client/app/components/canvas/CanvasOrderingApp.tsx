'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useDisplayUpdates } from '../../services/DisplayWebSocketService';
import { VertexAILiveService } from '../../services/VertexAILiveService';
import { cartStore } from '../../stores/cartStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import {
    AdaptiveDishCard,
    AIAdviceCard,
    TranscriptionOsd,
    AnchorStack
} from './CanvasPrimitives';
import { AudioVisualizer } from '../AudioVisualizer';

interface CanvasOrderingAppProps {
    tenantId: string;
    sessionId: string;
}

export const CanvasOrderingApp = observer(({ tenantId, sessionId }: CanvasOrderingAppProps) => {
    const { theme } = useTheme();
    const { profile: restaurantProfile } = useRestaurant();
    const [activePrimitives, setActivePrimitives] = useState<any[]>([]);
    const [transcription, setTranscription] = useState<{ text: string, speaker: 'user' | 'assistant' } | null>(null);
    const [localTranscription, setLocalTranscription] = useState('');
    const [isInitializing, setIsInitializing] = useState(true);
    const vertexServiceRef = useRef<VertexAILiveService | null>(null);
    const recordingContextRef = useRef<AudioContext | null>(null);
    const playbackContextRef = useRef<AudioContext | null>(null);
    const nextPlayTimeRef = useRef(0);
    const isPlayingRef = useRef(false);

    // Web Speech API for real-time local feedback
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setLocalTranscription(interimTranscript);
        };

        recognition.start();
        return () => recognition.stop();
    }, []);

    // Audio playback function
    const playPCMAudio = async (pcmData: ArrayBuffer) => {
        try {
            if (!playbackContextRef.current) {
                playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
            }

            const audioContext = playbackContextRef.current;
            const pcmArray = new Int16Array(pcmData);
            const floatArray = new Float32Array(pcmArray.length);
            for (let i = 0; i < pcmArray.length; i++) {
                floatArray[i] = pcmArray[i] / 32768.0;
            }

            const audioBuffer = audioContext.createBuffer(1, floatArray.length, 24000);
            audioBuffer.getChannelData(0).set(floatArray);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            const currentTime = audioContext.currentTime;
            const startTime = Math.max(currentTime, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + audioBuffer.duration;
            isPlayingRef.current = true;
        } catch (error) {
            console.error('[Canvas] Audio playback error:', error);
        }
    };

    // Start continuous microphone capture
    const startMicrophoneCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            recordingContextRef.current = new AudioContext({ sampleRate: 16000 });
            const source = recordingContextRef.current.createMediaStreamSource(stream);
            const processor = recordingContextRef.current.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (!vertexServiceRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }
                vertexServiceRef.current.sendAudio(pcmData.buffer);
            };

            source.connect(processor);
            processor.connect(recordingContextRef.current.destination);

            console.log('[Canvas] Microphone capture started');
        } catch (error) {
            console.error('[Canvas] Failed to start microphone:', error);
        }
    };

    // Initialize Vertex AI conversation
    useEffect(() => {
        const initializeConversation = async () => {
            try {
                console.log('[Canvas] Initializing Vertex AI conversation...');
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://handsfree-domain-service-prod.suyesh.workers.dev';

                // Create backend session
                const response = await fetch(`${apiUrl}/api/restaurant/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        tenantId: restaurantProfile?.tenantId || tenantId,
                        userId: 'canvas-user',
                        language: 'en'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to create session: ${response.status}`);
                }

                const sessionData = await response.json() as any;
                console.log('[Canvas] Session created:', sessionData);

                // Initialize Vertex AI service
                const wsUrl = `${apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')}${sessionData.websocketUrl}?tenantId=${tenantId}`;

                const vertexService = new VertexAILiveService(wsUrl);
                vertexServiceRef.current = vertexService;

                // Set up audio playback callback
                vertexService.onAudio(async (audioData: ArrayBuffer) => {
                    console.log('[Canvas] Audio response received');
                    await playPCMAudio(audioData);
                });

                // Set up message callback
                vertexService.onMessage((message: any) => {
                    console.log('[Canvas] Message:', message.type);
                    if (message.type === 'transcription') {
                        setTranscription({ text: message.text, speaker: message.speaker });
                    }
                });

                await vertexService.connect('en');
                console.log('[Canvas] Vertex AI connected');

                // Start microphone capture
                await startMicrophoneCapture();

                setIsInitializing(false);
            } catch (error) {
                console.error('[Canvas] Failed to initialize conversation:', error);
                setIsInitializing(false);
            }
        };

        initializeConversation();

        return () => {
            if (vertexServiceRef.current) {
                vertexServiceRef.current.disconnect();
                vertexServiceRef.current = null;
            }
            if (recordingContextRef.current) {
                recordingContextRef.current.close();
                recordingContextRef.current = null;
            }
            if (playbackContextRef.current) {
                playbackContextRef.current.close();
                playbackContextRef.current = null;
            }
        };
    }, [tenantId, restaurantProfile?.tenantId]);

    // Connect to display updates
    const { on, connected, service } = useDisplayUpdates({
        tenantId,
        sessionId,
        enabled: !!sessionId
    });

    // Handle incoming updates
    const handleUpdate = useCallback((update: any) => {
        console.log('[Canvas] New Update:', update.type, update);

        if (update.type === 'transcription') {
            setTranscription({ text: update.text, speaker: update.speaker });
            return;
        }

        // State-driven UI (Server-Side Logic)
        if (update.state && update.state.canvasState) {
            const serverState = update.state.canvasState;
            setActivePrimitives(serverState.activePrimitives || []);
            return;
        }

        // Fallback for direct updates
        if (['dish_card', 'advice_card', 'time_based_suggestions'].includes(update.type)) {
            setActivePrimitives(prev => {
                const primitiveId = `${update.type}-${update.timestamp || Date.now()}`;
                if (prev.some(p => p.id === primitiveId)) return prev;
                return [{ id: primitiveId, type: update.type, data: update }, ...prev].slice(0, 6);
            });
        }
    }, []);

    useEffect(() => {
        if (connected) {
            on('*', handleUpdate);
        }
    }, [connected, on, handleUpdate]);

    // Actions
    const handleAddToCart = (dish: any) => {
        cartStore.addMenuItem({
            id: dish.id,
            name: dish.name,
            price: dish.price,
            type: dish.is_vegetarian ? 'veg' : 'non-veg',
            imageUrl: dish.photo_url || dish.imageUrl,
            tenant_id: tenantId,
            category: dish.category,
            available: 1,
            is_vegetarian: dish.is_vegetarian,
            is_vegan: dish.is_vegan
        } as any);

        service?.sendAction('item_added', { dishId: dish.id, name: dish.name });
    };

    return (
        <div className="relative min-h-screen w-full bg-[#020617] overflow-hidden flex flex-col font-sans selection:bg-indigo-500/30">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
            </div>

            {/* Main Canvas Area */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-8">

                {/* Transcription Area (OSD) */}
                {(transcription || localTranscription) && (
                    <div className="w-full max-w-2xl px-4 animate-fade-in flex flex-col gap-2">
                        {localTranscription && (
                            <div className="text-white/40 text-xs font-mono mb-1 animate-pulse italic">
                                [Live Local] {localTranscription}...
                            </div>
                        )}
                        {transcription && (
                            <TranscriptionOsd text={transcription.text} speaker={transcription.speaker} />
                        )}
                    </div>
                )}

                {/* Display Stack */}
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {isInitializing && (
                        <div className="col-span-full text-white/30 text-center animate-pulse py-20">
                            <p className="text-xl font-light tracking-widest uppercase mb-2">Initializing...</p>
                            <p className="text-sm">Connecting to Vertex AI conversation agent</p>
                        </div>
                    )}
                    {!isInitializing && activePrimitives.length === 0 && !transcription && (
                        <div className="col-span-full text-white/30 text-center animate-pulse py-20">
                            <p className="text-xl font-light tracking-widest uppercase mb-2">Adaptive Canvas</p>
                            <p className="text-sm">Gemini is ready. Just speak to start.</p>
                        </div>
                    )}

                    {activePrimitives.map((ranked, index) => {
                        const update = ranked.data;
                        const key = ranked.id || `update-${index}`;

                        if (ranked.type === 'dish_card') {
                            return (
                                <AdaptiveDishCard
                                    key={key}
                                    dish={update.dish as any}
                                    animation={update.animation}
                                    onAdd={handleAddToCart}
                                />
                            );
                        }

                        if (ranked.type === 'advice_card') {
                            return (
                                <AIAdviceCard
                                    key={key}
                                    text={update.text}
                                    type={update.adviceType || 'suggestion'}
                                />
                            );
                        }

                        if (ranked.type === 'time_based_suggestions') {
                            return (
                                <div key={key} className="flex flex-col items-center gap-4">
                                    <h2 className="text-white/80 font-medium text-lg tracking-wide">{(update as any).headline}</h2>
                                    <AnchorStack
                                        items={(update as any).items}
                                        onSelect={handleAddToCart}
                                    />
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>
            </main>

            {/* Audio Visualizer - Bottom Right Corner */}
            <div className="fixed bottom-6 right-6 z-50 scale-[0.35] origin-bottom-right">
                <AudioVisualizer
                    audioLevels={new Array(32).fill(0).map(() => Math.random() * 0.1)}
                    sessionStatus={connected ? 'listening' : 'idle'}
                />
            </div>
        </div>
    );
});
