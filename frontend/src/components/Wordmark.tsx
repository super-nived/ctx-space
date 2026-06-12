import { cn } from '@/lib/cn';

interface WordmarkProps {
  className?: string;
  showFull?: boolean;
}

export function Wordmark({ className, showFull = true }: WordmarkProps) {
  return (
    <div className={cn('flex select-none items-center gap-2', className)}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 font-semibold text-white shadow-sm"
      >
        C
      </span>
      {showFull && (
        <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
          Context Space
        </span>
      )}
    </div>
  );
}
