import { cn } from '@/lib/cn';

interface WordmarkProps {
  className?: string;
  showFull?: boolean;
}

/** Context Space brand wordmark: a glyph tile + name. */
export function Wordmark({ className, showFull = true }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      <span
        aria-hidden
        className="bg-brand-600 grid h-7 w-7 place-items-center rounded-lg font-semibold text-white shadow-sm"
      >
        C
      </span>
      {showFull && (
        <span className="text-ink text-[15px] font-semibold tracking-tight">
          Context Space
        </span>
      )}
    </div>
  );
}
