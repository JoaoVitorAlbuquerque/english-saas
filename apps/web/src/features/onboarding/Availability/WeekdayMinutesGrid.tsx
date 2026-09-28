import type { AvailabilityMinutes } from '@english-saas/shared';
import {
  MAX_MINUTES_PER_DAY,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from '@english-saas/shared';

export function WeekdayMinutesGrid({
  value,
  onChange,
}: {
  value: AvailabilityMinutes;
  onChange: (next: AvailabilityMinutes) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {WEEKDAYS.map((day) => (
        <div key={day} className="flex items-center justify-between gap-3">
          <label htmlFor={`weekday-${day}`} className="text-sm text-ink">
            {WEEKDAY_LABELS[day]}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`weekday-${day}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_MINUTES_PER_DAY}
              step={5}
              value={value[day]}
              onChange={(event) => {
                const minutes = Math.min(
                  Math.max(Number(event.target.value) || 0, 0),
                  MAX_MINUTES_PER_DAY,
                );
                onChange({ ...value, [day]: minutes });
              }}
              className="h-11 w-20 rounded-lg border border-line bg-surface px-2 text-right text-base text-ink focus-visible:border-accent"
            />
            <span className="text-sm text-muted">min</span>
          </div>
        </div>
      ))}
    </div>
  );
}
