import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getScheduleCalendarMonths,
  getScheduleCalendarWeeks,
  isWithinScheduleWindow,
} from "../utils/scheduleDateTimeUtils";

const WEEKDAYS = [
  ["Su", "Sunday"],
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
];

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

const sameDate = (a, b) =>
  Boolean(a && b) && a.year === b.year && a.month === b.month && a.day === b.day;

const dateKey = ({ year, month, day }) => `${year}-${month}-${day}`;

// Dates are built from their parts in local time, so the weekday and label are
// right whatever time zone the browser is in.
const longDate = ({ year, month, day }) =>
  new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const monthTitle = ({ year, month }) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

function parseSelected(meetingYear, meetingMonth, meetingDay) {
  const year = parseInt(meetingYear, 10);
  const month = parseInt(meetingMonth, 10);
  const day = parseInt(meetingDay, 10);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/**
 * Month-grid alternative to the date dropdowns. Only dates inside the
 * scheduling window can be picked; arrow keys move between days and across
 * months without leaving the window.
 */
export default function ScheduleCalendar({
  bounds,
  meetingYear,
  meetingMonth,
  meetingDay,
  onSelectDate,
}) {
  const titleId = useId();
  const months = useMemo(() => getScheduleCalendarMonths(bounds), [bounds]);
  const selected = parseSelected(meetingYear, meetingMonth, meetingDay);
  const today = { year: bounds.currentYear, month: bounds.currentMonth, day: bounds.currentDay };

  const [view, setView] = useState(() => {
    const start = selected && isWithinScheduleWindow(selected.year, selected.month, selected.day, bounds)
      ? selected
      : today;
    return { year: start.year, month: start.month };
  });
  const [active, setActive] = useState(null);
  const [moveFocus, setMoveFocus] = useState(false);
  const dayRefs = useRef(new Map());

  const viewIndex = months.findIndex((m) => m.year === view.year && m.month === view.month);
  const weeks = getScheduleCalendarWeeks(view.year, view.month, bounds);
  const inView = (date) => date && date.year === view.year && date.month === view.month;
  const selectable = (day) =>
    isWithinScheduleWindow(view.year, view.month, day, bounds);

  // One day in the grid is reachable with Tab: the one being moved through,
  // else the chosen date, else today, else the first open day of the month.
  const firstOpen = weeks.flat().find((cell) => cell?.selectable);
  const tabbable =
    [active, selected, today].find((date) => inView(date) && selectable(date.day))
    || (firstOpen ? { ...view, day: firstOpen.day } : null);

  useEffect(() => {
    if (!moveFocus || !active) return;
    dayRefs.current.get(dateKey(active))?.focus();
    setMoveFocus(false);
  }, [moveFocus, active, view]);

  const showMonth = (index) => {
    setView(months[index]);
    setActive(null);
  };

  const onDayKeyDown = (event, date) => {
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const moved = new Date(date.year, date.month - 1, date.day + step);
    const next = { year: moved.getFullYear(), month: moved.getMonth() + 1, day: moved.getDate() };
    if (!isWithinScheduleWindow(next.year, next.month, next.day, bounds)) return;
    setView({ year: next.year, month: next.month });
    setActive(next);
    setMoveFocus(true);
  };

  const navButtonClass =
    "flex h-9 w-9 coarse:h-11 coarse:w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700";

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-2 sm:p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => showMonth(viewIndex - 1)}
          disabled={viewIndex <= 0}
          aria-label="Previous month"
          className={navButtonClass}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>
        <h3 id={titleId} aria-live="polite" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthTitle(view)}
        </h3>
        <button
          type="button"
          onClick={() => showMonth(viewIndex + 1)}
          disabled={viewIndex >= months.length - 1}
          aria-label="Next month"
          className={navButtonClass}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1" aria-labelledby={titleId}>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, full]) => (
              <th key={full} scope="col" abbr={full} className="pb-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((cell, d) => {
                if (!cell) return <td key={d} />;
                const date = { ...view, day: cell.day };
                const isSelected = sameDate(date, selected);
                const isToday = sameDate(date, today);
                const tone = isSelected
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : cell.selectable
                    ? "text-gray-900 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-gray-700"
                    : "cursor-not-allowed text-gray-300 dark:text-gray-600";
                return (
                  <td key={d} className="p-0">
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) dayRefs.current.set(dateKey(date), node);
                        else dayRefs.current.delete(dateKey(date));
                      }}
                      disabled={!cell.selectable}
                      tabIndex={sameDate(date, tabbable) ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={longDate(date)}
                      onClick={() => onSelectDate(date)}
                      onKeyDown={(event) => onDayKeyDown(event, date)}
                      onFocus={() => setActive(date)}
                      className={`flex h-10 w-full coarse:h-11 items-center justify-center rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tone} ${isToday && !isSelected ? "font-bold ring-1 ring-blue-400" : ""}`}
                    >
                      {cell.day}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p aria-live="polite" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {selected ? `Selected: ${longDate(selected)}` : "Pick a date between today and three months from now."}
      </p>
    </div>
  );
}
