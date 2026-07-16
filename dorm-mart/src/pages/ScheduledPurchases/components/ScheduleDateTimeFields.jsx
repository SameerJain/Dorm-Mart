import { getMaxDayForMeetingMonth } from "../utils/scheduleDateTimeUtils";

export default function ScheduleDateTimeFields({
  dayInputRef,
  meetingAmPm,
  meetingDay,
  meetingHour,
  meetingMinute,
  meetingMonth,
  meetingYear,
  monthInputRef,
  setDateTimeError,
  setMeetingAmPm,
  setMeetingDay,
  setMeetingHour,
  setMeetingMinute,
  setMeetingMonth,
  setMeetingYear,
  yearInputRef,
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Meeting Date &amp; Time <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Date
          </label>
          <div className="flex items-center w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <input
              ref={monthInputRef}
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={meetingMonth}
              maxLength={2}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                if (raw === "") {
                  setMeetingMonth("");
                  setDateTimeError("");
                  return;
                }
                const first = parseInt(raw[0]);
                if (raw.length === 1) {
                  if (first > 1) {
                    setMeetingMonth(`0${raw}`);
                    setDateTimeError("");
                    dayInputRef.current?.focus();
                    dayInputRef.current?.select();
                  } else {
                    setMeetingMonth(raw);
                    setDateTimeError("");
                  }
                } else {
                  const val = parseInt(raw);
                  if (val >= 1 && val <= 12) {
                    setMeetingMonth(raw);
                    setDateTimeError("");
                    dayInputRef.current?.focus();
                    dayInputRef.current?.select();
                  }
                }
              }}
              className="w-7 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600"
            />
            <span className="text-gray-400 dark:text-gray-500 select-none">/</span>
            <input
              ref={dayInputRef}
              type="text"
              inputMode="numeric"
              placeholder="DD"
              value={meetingDay}
              maxLength={2}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                if (raw === "") {
                  setMeetingDay("");
                  setDateTimeError("");
                  return;
                }
                const maxDay = meetingMonth
                  ? getMaxDayForMeetingMonth(meetingMonth)
                  : 31;
                const first = parseInt(raw[0]);
                if (raw.length === 1) {
                  if (first > 3) {
                    const padded = `0${raw}`;
                    if (parseInt(padded) <= maxDay) {
                      setMeetingDay(padded);
                      setDateTimeError("");
                      yearInputRef.current?.focus();
                      yearInputRef.current?.select();
                    }
                  } else {
                    setMeetingDay(raw);
                    setDateTimeError("");
                  }
                } else {
                  const val = parseInt(raw);
                  if (val >= 1 && val <= maxDay) {
                    setMeetingDay(raw);
                    setDateTimeError("");
                    yearInputRef.current?.focus();
                    yearInputRef.current?.select();
                  }
                }
              }}
              className="w-7 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600"
            />
            <span className="text-gray-400 dark:text-gray-500 select-none">/</span>
            <input
              ref={yearInputRef}
              type="text"
              inputMode="numeric"
              placeholder="YYYY"
              value={meetingYear}
              maxLength={4}
              onChange={(e) => {
                setMeetingYear(e.target.value.replace(/\D/g, "").slice(0, 4));
                setDateTimeError("");
              }}
              className="w-10 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600"
            />
          </div>
        </div>
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
    </div>
  );
}

function SelectField({ children, label, onChange, value }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <select
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
