const EASTERN_TIME_ZONE = "America/New_York";

export function convertTo24Hour(hour, amPm) {
  const hourNum = parseInt(hour);
  if (amPm === "PM" && hourNum !== 12) {
    return hourNum + 12;
  }
  if (amPm === "AM" && hourNum === 12) {
    return 0;
  }
  return hourNum;
}

export function combineScheduleDateTime({
  meetingMonth,
  meetingDay,
  meetingYear,
  meetingHour,
  meetingMinute,
  meetingAmPm,
}) {
  if (
    !meetingMonth ||
    !meetingDay ||
    !meetingYear ||
    meetingYear.length < 4 ||
    !meetingHour ||
    !meetingMinute ||
    !meetingAmPm
  ) {
    return null;
  }

  const hour24 = convertTo24Hour(meetingHour, meetingAmPm);
  const year = parseInt(meetingYear);
  const month = parseInt(meetingMonth);
  const day = parseInt(meetingDay);
  const dateTimeString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour24).padStart(2, "0")}:${meetingMinute}:00`;
  const easternTimeOptions = {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const checkUtcDate = (utcOffset) => {
    const utcDate = new Date(`${dateTimeString}${utcOffset}`);
    const utcAsEastern = utcDate.toLocaleString("en-US", easternTimeOptions);
    const parts = utcAsEastern.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
    if (!parts) return null;

    const [, partMonth, partDay, partYear, partHour, partMinute] =
      parts.map(Number);
    if (
      partYear === year &&
      partMonth === month &&
      partDay === day &&
      partHour === hour24 &&
      partMinute === parseInt(meetingMinute)
    ) {
      return utcDate.toISOString();
    }
    return null;
  };

  // Probe both Eastern offsets because meeting dates may fall in EST or EDT.
  return (
    checkUtcDate("-05:00") ||
    checkUtcDate("-04:00") ||
    new Date(`${dateTimeString}-05:00`).toISOString()
  );
}

export function getEasternTime() {
  const now = new Date();
  const easternFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = easternFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year").value);
  const month = parseInt(parts.find((p) => p.type === "month").value) - 1;
  const day = parseInt(parts.find((p) => p.type === "day").value);
  const hour = parseInt(parts.find((p) => p.type === "hour").value);
  const minute = parseInt(parts.find((p) => p.type === "minute").value);
  const second = parseInt(parts.find((p) => p.type === "second").value);

  return new Date(year, month, day, hour, minute, second);
}

export function getMaxDayForMeetingMonth(monthValue, referenceDate = getEasternTime()) {
  const month = parseInt(monthValue);
  if (!Number.isInteger(month) || month < 1 || month > 12) return 31;
  return new Date(referenceDate.getFullYear(), month, 0).getDate();
}

export function getDateRangeMessage(meetingMonth, meetingDay, meetingYear) {
  if (
    !meetingMonth ||
    meetingMonth.length < 2 ||
    !meetingDay ||
    meetingDay.length < 2 ||
    !meetingYear ||
    meetingYear.length < 4
  ) {
    return "";
  }

  const easternNow = getEasternTime();
  const currentYear = easternNow.getFullYear();
  const currentMonth = easternNow.getMonth();
  const currentDay = easternNow.getDate();
  const selected = new Date(
    parseInt(meetingYear),
    parseInt(meetingMonth) - 1,
    parseInt(meetingDay),
  );
  const today = new Date(currentYear, currentMonth, currentDay);
  const maxDate = new Date(currentYear, currentMonth + 3, currentDay);

  if (selected < today) {
    return "Meeting date cannot be in the past.";
  }
  if (selected > maxDate) {
    return "Meeting date cannot be more than 3 months in advance.";
  }
  return "";
}

export function getTodayDate() {
  const easternNow = getEasternTime();
  const year = easternNow.getFullYear();
  const month = String(easternNow.getMonth() + 1).padStart(2, "0");
  const day = String(easternNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMaxDate() {
  const easternNow = getEasternTime();
  const threeMonthsFromNow = new Date(easternNow);
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  const year = threeMonthsFromNow.getFullYear();
  const month = String(threeMonthsFromNow.getMonth() + 1).padStart(2, "0");
  const day = String(threeMonthsFromNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDerivedYear(month, day) {
  const easternNow = getEasternTime();
  const currentYear = easternNow.getFullYear();
  const today = new Date(
    currentYear,
    easternNow.getMonth(),
    easternNow.getDate(),
  );
  const thisYearDate = new Date(
    currentYear,
    parseInt(month) - 1,
    parseInt(day),
  );
  return thisYearDate >= today ? currentYear : currentYear + 1;
}

export function validateScheduleDateTime({
  meetingMonth,
  meetingDay,
  meetingYear,
  meetingHour,
  meetingMinute,
  meetingAmPm,
}) {
  const missingFields = [];
  if (!meetingMonth || !meetingDay || !meetingYear || meetingYear.length < 4) {
    missingFields.push("meeting date");
  }
  if (!meetingHour) missingFields.push("meeting hour");
  if (!meetingMinute) missingFields.push("meeting minute");
  if (!meetingAmPm) missingFields.push("AM/PM");

  if (missingFields.length > 0) {
    if (missingFields.length === 1) {
      return `Please select a ${missingFields[0]}.`;
    }
    if (missingFields.length === 2) {
      return `Please select ${missingFields[0]} and ${missingFields[1]}.`;
    }
    const lastField = missingFields.pop();
    return `Please select ${missingFields.join(", ")}, and ${lastField}.`;
  }

  const easternNow = getEasternTime();
  const easternYear = easternNow.getFullYear();
  const easternMonth = easternNow.getMonth() + 1;
  const easternDay = easternNow.getDate();
  const easternHour = easternNow.getHours();
  const easternMinute = easternNow.getMinutes();
  const year = parseInt(meetingYear);
  const month = parseInt(meetingMonth);
  const day = parseInt(meetingDay);
  const selectedHour24 = convertTo24Hour(meetingHour, meetingAmPm);
  const selectedMinute = parseInt(meetingMinute);

  if (
    year < easternYear ||
    (year === easternYear && month < easternMonth) ||
    (year === easternYear && month === easternMonth && day < easternDay)
  ) {
    return "Meeting date cannot be in the past.";
  }

  if (
    year === easternYear &&
    month === easternMonth &&
    day === easternDay &&
    (selectedHour24 < easternHour ||
      (selectedHour24 === easternHour && selectedMinute <= easternMinute))
  ) {
    return "Meeting time must be in the future.";
  }

  const selectedDateTime = new Date(
    year,
    month - 1,
    day,
    selectedHour24,
    selectedMinute,
    0,
  );
  const threeMonthsFromNow = new Date(easternNow);
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

  if (selectedDateTime > threeMonthsFromNow) {
    return "Meeting date cannot be more than 3 months in advance.";
  }

  return "";
}
