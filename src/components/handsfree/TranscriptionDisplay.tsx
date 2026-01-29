/**
 * Transcription Display Component
 * Shows conversation transcript between user and AI assistant
 */

import { useEffect, useRef } from 'react';
import { User, Bot, Clock } from 'lucide-react';
import type { TranscriptEntry } from '../../services/HandsfreeSetupAgent';

// ============================================================================
// Props Interface
// ============================================================================

export interface TranscriptionDisplayProps {
  transcript: TranscriptEntry[];
  maxEntries?: number; // Limit number of entries shown (default: show all)
  compact?: boolean; // Compact mode for floating display
  autoScroll?: boolean; // Auto-scroll to latest entry (default: true)
  showTimestamps?: boolean; // Show message timestamps (default: false)
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function TranscriptionDisplay({
  transcript,
  maxEntries,
  compact = false,
  autoScroll = true,
  showTimestamps = false,
  className = '',
}: TranscriptionDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEntryRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (autoScroll && lastEntryRef.current) {
      lastEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [transcript, autoScroll]);

  // Limit entries if maxEntries specified
  const displayedTranscript = maxEntries
    ? transcript.slice(-maxEntries)
    : transcript;

  if (displayedTranscript.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`
        ${compact ? 'max-h-48' : 'max-h-96'}
        overflow-y-auto
        space-y-3
        ${className}
      `}
    >
      {displayedTranscript.map((entry, index) => {
        const isLast = index === displayedTranscript.length - 1;

        return (
          <div
            key={`${entry.timestamp}-${index}`}
            ref={isLast ? lastEntryRef : null}
            className={`
              flex gap-3
              ${entry.role === 'user' ? 'flex-row' : 'flex-row-reverse'}
            `}
          >
            {/* Avatar */}
            <div
              className={`
                flex-shrink-0
                w-8 h-8
                rounded-full
                flex items-center justify-center
                ${
                  entry.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-green-500 text-white'
                }
              `}
            >
              {entry.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={`
                flex-1
                ${entry.role === 'user' ? 'text-left' : 'text-right'}
              `}
            >
              {/* Timestamp (optional) */}
              {showTimestamps && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(entry.timestamp)}
                </div>
              )}

              {/* Message Content */}
              <div
                className={`
                  inline-block
                  px-4 py-2
                  rounded-lg
                  ${compact ? 'text-sm' : 'text-base'}
                  ${
                    entry.role === 'user'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-green-100 text-green-900'
                  }
                  shadow-sm
                  max-w-full
                  break-words
                `}
              >
                {entry.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// ============================================================================
// Compact Transcript (Alternative Version)
// ============================================================================

export interface CompactTranscriptProps {
  transcript: TranscriptEntry[];
  maxEntries?: number;
}

/**
 * Ultra-compact transcript for floating button
 */
export function CompactTranscript({ transcript, maxEntries = 1 }: CompactTranscriptProps) {
  const latest = transcript.slice(-maxEntries);

  if (latest.length === 0) {
    return null;
  }

  const entry = latest[0];

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-start gap-2">
        <div
          className={`
            w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
            ${entry.role === 'user' ? 'bg-blue-500' : 'bg-green-500'}
            text-white
          `}
        >
          {entry.role === 'user' ? (
            <User className="w-3 h-3" />
          ) : (
            <Bot className="w-3 h-3" />
          )}
        </div>

        <div className="flex-1">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {entry.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div className="text-sm text-gray-800 line-clamp-2">{entry.content}</div>
        </div>
      </div>
    </div>
  );
}
