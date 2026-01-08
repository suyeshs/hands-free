/**
 * Config Card Component
 * Reusable card for optional configuration items in provisioning
 */

interface ConfigCardProps {
  icon: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive?: boolean;
  onClick: () => void;
}

export function ConfigCard({
  icon,
  title,
  description,
  isComplete,
  isActive = false,
  onClick,
}: ConfigCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-5 rounded-xl text-left transition-all
        ${
          isActive
            ? 'bg-accent/20 border-2 border-accent ring-2 ring-accent/20'
            : isComplete
            ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/15'
            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
        }
      `}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl
            ${
              isComplete
                ? 'bg-green-500/20'
                : isActive
                ? 'bg-accent/20'
                : 'bg-white/10'
            }
          `}
        >
          {isComplete ? (
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            icon
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-foreground truncate">{title}</h3>
            {isComplete && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">
                Done
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>

        {/* Arrow */}
        <div className="shrink-0 text-muted-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export default ConfigCard;
