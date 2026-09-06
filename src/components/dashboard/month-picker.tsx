import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The prev/next month nav shown in the header of every month-scoped page
 * (Dashboard, Budgets, Income, Expenses, Debts). Pulled out as a single
 * component so all five stay visually identical instead of drifting —
 * they'd each grown a slightly different border, width, and font size.
 */
export function MonthPicker({
  month,
  year,
  onPrev,
  onNext,
  nextDisabled,
}: {
  month: number; // 1-12
  year: number;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border p-1 shrink-0">
      <button
        onClick={onPrev}
        className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[72px] text-center text-xs font-medium">
        {MONTH_NAMES_SHORT[month - 1]} {year}
      </span>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
