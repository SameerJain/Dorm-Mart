import { useEffect, useId, useMemo, useState } from "react";
import ScheduleCalendar from "./ScheduleCalendar";
import {
  getScheduleDayOptions,
  getScheduleMonthOptions,
  getScheduleWindowBounds,
  getScheduleYearOptions,
} from "../utils/scheduleDateTimeUtils";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ScheduleDateTimeFields({
  meetingAmPm,
  meetingDay,
  meetingHour,
  meetingMinute,
  meetingMonth,
  meetingYear,
  setDateTimeError,
  setMeetingAmPm,
  setMeetingDay,
  setMeetingHour,
  setMeetingMinute,
  setMeetingMonth,
  setMeetingYear,
}) {
  const bounds = useMemo(() => getScheduleWindowBounds(), []);
  const yearOptions = useMemo(() => getScheduleYearOptions(bounds), [bounds]);
  const showYearDropdown = yearOptions.length > 1;

  useEffect(() => {
    if (!showYearDropdown && meetingYear !== String(bounds.currentYear)) {
      setMeetingYear(String(bounds.currentYear));
    }
  }, [bounds.currentYear, meetingYear, setMeetingYear, showYearDropdown]);

  const effectiveYear = meetingYear
    ? parseInt(meetingYear, 10)
    : bounds.currentYear;
  const monthOptions = useMemo(
    () => getScheduleMonthOptions(effectiveYear, bounds),
    [effectiveYear, bounds],
  );

  const effectiveMonth = meetingMonth ? parseInt(meetingMonth, 10) : null;
  const dayOptions = useMemo(
    () =>
      effectiveMonth
        ? getScheduleDayOptions(effectiveYear, effectiveMonth, bounds)
        : [],
    [effectiveYear, effectiveMonth, bounds],
  );

  const handleYearChange = (value) => {
    setMeetingYear(value);
    setDateTimeError("");
    if (!value || !meetingMonth) return;

    const year = parseInt(value, 10);
    const validMonths = getScheduleMonthOptions(year, bounds);
    if (!validMonths.includes(parseInt(meetingMonth, 10))) {
      setMeetingMonth("");
      setMeetingDay("");
      return;
    }
    if (meetingDay) {
      const validDays = getScheduleDayOptions(
        year,
        parseInt(meetingMonth, 10),
        bounds,
      );
      if (!validDays.includes(parseInt(meetingDay, 10))) {
        setMeetingDay("");
      }
    }
  };

  const [picker, setPicker] = useState("dropdowns");

  const handleCalendarSelect = ({ year, month, day }) => {
    setMeetingYear(String(year));
    setMeetingMonth(String(month).padStart(2, "0"));
    setMeetingDay(String(day).padStart(2, "0"));
    setDateTimeError("");
  };

  const handleMonthChange = (value) => {
    setMeetingMonth(value);
    setDateTimeError("");
    if (!value || !meetingDay) return;

    const validDays = getScheduleDayOptions(
      effectiveYear,
      parseInt(value, 10),
      bounds,
    );
    if (!validDays.includes(parseInt(meetingDay, 10))) {
      setMeetingDay("");
    }
  };

  return (
    <fieldset>
      <legend className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Meeting Date &amp; Time <span className="text-red-500">*</span>
      </legend>
      <div
        role="group"
        aria-label="Pick the date with"
        className="mb-3 inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
      >
        {[
          ["dropdowns", "Dropdowns"],
          ["calendar", "Calendar"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={picker === value}
            onClick={() => setPicker(value)}
            className={`rounded-md px-3 py-1.5 coarse:min-h-[44px] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              picker === value
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {picker === "calendar" ? (
        <ScheduleCalendar
          bounds={bounds}
          meetingYear={meetingYear}
          meetingMonth={meetingMonth}
          meetingDay={meetingDay}
          onSelectDate={handleCalendarSelect}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField label="Month" value={meetingMonth} onChange={handleMonthChange}>
            <option value="">Month</option>
            {monthOptions.map((month) => (
              <option key={month} value={String(month).padStart(2, "0")}>
                {MONTH_NAMES[month - 1]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Day"
            value={meetingDay}
            onChange={(value) => {
              setMeetingDay(value);
              setDateTimeError("");
            }}
          >
            <option value="">Day</option>
            {dayOptions.map((day) => (
              <option key={day} value={String(day).padStart(2, "0")}>
                {day}
              </option>
            ))}
          </SelectField>
          {showYearDropdown ? (
            <SelectField label="Year" value={meetingYear} onChange={handleYearChange}>
              <option value="">Year</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </SelectField>
          ) : (
            <StaticField label="Year" value={bounds.currentYear} />
          )}
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          label="Hour"
          value={meetingHour}
          onChange={(value) => {
            setMeetingHour(value);
            setDateTimeError("");
          }}
        >
          <option value="">--</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
            <option key={hour} value={String(hour)}>
              {hour}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Minute"
          value={meetingMinute}
          onChange={(value) => {
            setMeetingMinute(value);
            setDateTimeError("");
          }}
        >
          <option value="">--</option>
          {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => {
            const minuteStr = String(minute).padStart(2, "0");
            return (
              <option key={minuteStr} value={minuteStr}>
                {minuteStr}
              </option>
            );
          })}
        </SelectField>
        <SelectField
          label="AM/PM"
          value={meetingAmPm}
          onChange={(value) => {
            setMeetingAmPm(value);
            setDateTimeError("");
          }}
        >
          <option value="">--</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </SelectField>
      </div>
    </fieldset>
  );
}

function SelectField({ children, label, onChange, value }) {
  const selectId = useId();

  return (
    <div>
      <label htmlFor={selectId} className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
    </div>
  );
}

function StaticField({ label, value }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <div className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {value}
      </div>
    </div>
  );
}
