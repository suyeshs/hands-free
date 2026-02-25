'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceOrbProps {
  isConnected: boolean;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onAudioData: (data: ArrayBuffer) => void;
}

export function VoiceOrb({
  isConnected,
  isListening,
  onStartListening,
  onStopListening,
  onAudioData,
}: VoiceOrbProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Setup audio analysis for visualization
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start level monitoring
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const arrayBuffer = await event.data.arrayBuffer();
          onAudioData(arrayBuffer);
        }
      };

      mediaRecorder.start(100); // Send chunks every 100ms
      setIsRecording(true);
      onStartListening();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRecording(false);
    setAudioLevel(0);
    onStopListening();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Calculate orb scale based on audio level
  const orbScale = 1 + audioLevel * 0.3;

  return (
    <div className="flex flex-col items-center">
      {/* Orb Container */}
      <div className="relative">
        {/* Outer glow rings */}
        {isRecording && (
          <>
            <div
              className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"
              style={{ transform: `scale(${1.5 + audioLevel * 0.5})` }}
            />
            <div
              className="absolute inset-0 rounded-full bg-blue-500/10"
              style={{ transform: `scale(${1.3 + audioLevel * 0.3})` }}
            />
          </>
        )}

        {/* Main orb button */}
        <button
          onClick={toggleRecording}
          disabled={!isConnected}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-200 transform
            ${isConnected
              ? isRecording
                ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50'
                : 'bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-md hover:shadow-lg'
              : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
            }
          `}
          style={{ transform: `scale(${orbScale})` }}
        >
          {!isConnected ? (
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          ) : isRecording ? (
            <Mic className="w-8 h-8 text-white animate-pulse" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {/* Status text */}
      <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
        {!isConnected ? (
          'Connecting...'
        ) : isRecording ? (
          <span className="text-blue-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Listening...
          </span>
        ) : (
          'Tap to speak'
        )}
      </p>

      {/* Audio level indicator */}
      {isRecording && (
        <div className="mt-2 flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-500 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, audioLevel * 24 * (1 + Math.sin(Date.now() / 100 + i)))}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default VoiceOrb;
