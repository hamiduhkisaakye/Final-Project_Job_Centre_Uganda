'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Custom, dependency-free month grid — deliberately simple (no library) to
// match the mockup's plain calendar rather than pulling in a full date-
// picker package for one page.
export default function InterviewCalendar({
  month,
  onMonthChange,
  markedDates,
  selectedDate,
  onSelectDate,
}: {
  month: Date; // any date within the month to display
  onMonthChange: (d: Date) => void;
  markedDates: Set<string>;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  // Monday-first grid: JS getDay() is 0=Sunday, shift so Monday=0.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold">{firstOfMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
            className="w-7 h-7 rounded flex items-center justify-center text-muted hover:bg-ground hover:text-ink transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
            className="w-7 h-7 rounded flex items-center justify-center text-muted hover:bg-ground hover:text-ink transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted font-semibold mb-1.5">
        {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const marked = markedDates.has(toKey(d));
          const isToday = isSameDay(d, today);
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(d)}
              className={`h-9 rounded flex flex-col items-center justify-center text-sm transition-colors relative ${
                isSelected ? 'bg-primary text-white font-semibold' : isToday ? 'border border-primary text-primary font-semibold' : 'text-ink hover:bg-ground'
              }`}
            >
              {d.getDate()}
              {marked && <span className={`w-1 h-1 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-accent'}`} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-ground text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Interview</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-primary" /> Today</span>
      </div>
    </div>
  );
}
