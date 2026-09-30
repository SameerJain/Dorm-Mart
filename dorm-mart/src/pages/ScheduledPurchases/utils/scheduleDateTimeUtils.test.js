import {
  combineScheduleDateTime,
  convertTo24Hour,
  getDateRangeMessage,
  getEasternTime,
  getMaxDayForMeetingMonth,
  getScheduleDayOptions,
  getScheduleMonthOptions,
  getScheduleWindowBounds,
  getScheduleYearOptions,
  validateScheduleDateTime,
} from "./scheduleDateTimeUtils";

// Expectations are Eastern wall-clock values or UTC instants, so these pass
// whatever time zone the machine running Jest is in.
function freezeNow(isoInstant) {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date(isoInstant));
}

afterEach(() => {
  jest.useRealTimers();
});

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("convertTo24Hour", () => {
  test.each([
    ["12", "AM", 0],
    ["1", "AM", 1],
    ["11", "AM", 11],
    ["12", "PM", 12],
    ["1", "PM", 13],
    ["11", "PM", 23],
  ])("%s %s is hour %i", (hour, amPm, expected) => {
    expect(convertTo24Hour(hour, amPm)).toBe(expected);
  });
});

describe("combineScheduleDateTime", () => {
  const meeting = {
    meetingMonth: "01",
    meetingDay: "15",
    meetingYear: "2026",
    meetingHour: "3",
    meetingMinute: "30",
    meetingAmPm: "PM",
  };

  test("reads the form as Eastern time in both standard and daylight time", () => {
    expect(combineScheduleDateTime(meeting)).toBe("2026-01-15T20:30:00.000Z");
    expect(combineScheduleDateTime({ ...meeting, meetingMonth: "07" })).toBe(
      "2026-07-15T19:30:00.000Z",
    );
    expect(
      combineScheduleDateTime({ ...meeting, meetingHour: "12", meetingMinute: "05", meetingAmPm: "AM" }),
    ).toBe("2026-01-15T05:05:00.000Z");
  });

  test("resolves the clock-change hours deterministically", () => {
    // 2:30 AM on the spring-forward day does not exist; it falls back to EST.
    expect(
      combineScheduleDateTime({ ...meeting, meetingMonth: "03", meetingDay: "08", meetingHour: "2", meetingAmPm: "AM" }),
    ).toBe("2026-03-08T07:30:00.000Z");
    // 1:30 AM happens twice on the fall-back day; the EST (second) one is used.
    expect(
      combineScheduleDateTime({ ...meeting, meetingMonth: "11", meetingDay: "01", meetingHour: "1", meetingAmPm: "AM" }),
    ).toBe("2026-11-01T06:30:00.000Z");
  });

  test.each([
    "meetingMonth",
    "meetingDay",
    "meetingYear",
    "meetingHour",
    "meetingMinute",
    "meetingAmPm",
  ])("returns null without %s", (field) => {
    expect(combineScheduleDateTime({ ...meeting, [field]: "" })).toBeNull();
  });

  test("returns null for a partly typed year", () => {
    expect(combineScheduleDateTime({ ...meeting, meetingYear: "202" })).toBeNull();
  });
});

describe("getEasternTime", () => {
  test("returns Eastern wall-clock fields in daylight and standard time", () => {
    // Every field differs (month 09, day 30, hour 10, minute 07, second 41), so
    // reading the wrong part cannot pass.
    freezeNow("2026-09-30T14:07:41Z");
    const summer = getEasternTime();
    expect([summer.getFullYear(), summer.getMonth(), summer.getDate()]).toEqual([2026, 8, 30]);
    expect([summer.getHours(), summer.getMinutes(), summer.getSeconds()]).toEqual([10, 7, 41]);

    jest.setSystemTime(new Date("2026-01-01T03:00:00Z"));
    const winter = getEasternTime();
    // Still New Year's Eve in Buffalo.
    expect([winter.getFullYear(), winter.getMonth(), winter.getDate(), winter.getHours()]).toEqual([
      2025, 11, 31, 22,
    ]);
  });
});

describe("getMaxDayForMeetingMonth", () => {
  const ref = new Date(2025, 0, 15);

  // "13" is not enough: it rolls over to January, which also has 31 days.
  test.each([
    ["14", "rolls to February without the guard"],
    ["-1", "rolls to November without the guard"],
    ["abc", "is NaN without the guard"],
  ])("month %p falls back to 31 (%s)", (month) => {
    expect(getMaxDayForMeetingMonth(month, ref)).toBe(31);
  });
});

describe("getDateRangeMessage", () => {
  beforeEach(() => freezeNow("2026-09-30T14:00:00Z")); // 10:00 AM Eastern

  test("waits for a fully typed date", () => {
    expect(getDateRangeMessage("9", "01", "2026")).toBe("");
    expect(getDateRangeMessage("09", "1", "2026")).toBe("");
    expect(getDateRangeMessage("09", "01", "202")).toBe("");
    expect(getDateRangeMessage("", "01", "2026")).toBe("");
  });

  test("allows today through exactly three months out", () => {
    expect(getDateRangeMessage("09", "30", "2026")).toBe("");
    expect(getDateRangeMessage("12", "30", "2026")).toBe("");
  });

  test("rejects dates outside the window", () => {
    expect(getDateRangeMessage("09", "29", "2026")).toBe("Meeting date cannot be in the past.");
    expect(getDateRangeMessage("12", "31", "2026")).toBe(
      "Meeting date cannot be more than 3 months in advance.",
    );
  });
});

describe("schedule window options", () => {
  const sameYear = getScheduleWindowBounds(new Date(2026, 8, 30));
  const crossesYear = getScheduleWindowBounds(new Date(2026, 10, 15));

  test("bounds run from today to three months out", () => {
    expect(sameYear).toEqual({
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 30,
      maxYear: 2026,
      maxMonth: 12,
      maxDay: 30,
    });
    expect(crossesYear).toEqual({
      currentYear: 2026,
      currentMonth: 11,
      currentDay: 15,
      maxYear: 2027,
      maxMonth: 2,
      maxDay: 15,
    });
  });

  test("years include next year only when the window reaches it", () => {
    expect(getScheduleYearOptions(sameYear)).toEqual([2026]);
    expect(getScheduleYearOptions(crossesYear)).toEqual([2026, 2027]);
  });

  test("months are clipped at both ends of the window", () => {
    expect(getScheduleMonthOptions(2026, sameYear)).toEqual([9, 10, 11, 12]);
    expect(getScheduleMonthOptions(2026, crossesYear)).toEqual([11, 12]);
    expect(getScheduleMonthOptions(2027, crossesYear)).toEqual([1, 2]);
  });

  test("days are clipped to today, the last day, and the month length", () => {
    expect(getScheduleDayOptions(2026, 9, sameYear)).toEqual([30]);
    expect(getScheduleDayOptions(2026, 10, sameYear)).toEqual(range(1, 31));
    expect(getScheduleDayOptions(2026, 12, sameYear)).toEqual(range(1, 30));
    expect(getScheduleDayOptions(2026, 11, crossesYear)).toEqual(range(15, 30));
    expect(getScheduleDayOptions(2027, 2, crossesYear)).toEqual(range(1, 15));
  });

  test("February length follows the year being scheduled", () => {
    const leap = { currentYear: 2027, currentMonth: 12, currentDay: 10, maxYear: 2028, maxMonth: 3, maxDay: 10 };
    expect(getScheduleDayOptions(2028, 2, leap)).toEqual(range(1, 29));
    const common = { currentYear: 2026, currentMonth: 12, currentDay: 10, maxYear: 2027, maxMonth: 3, maxDay: 10 };
    expect(getScheduleDayOptions(2027, 2, common)).toEqual(range(1, 28));
  });
});

describe("validateScheduleDateTime", () => {
  const at = (month, day, year, hour, minute, amPm) => ({
    meetingMonth: month,
    meetingDay: day,
    meetingYear: year,
    meetingHour: hour,
    meetingMinute: minute,
    meetingAmPm: amPm,
  });

  beforeEach(() => freezeNow("2026-09-30T14:00:00Z")); // 10:00 AM Eastern

  test("names every missing field in a readable list", () => {
    expect(validateScheduleDateTime(at("", "", "", "", "", ""))).toBe(
      "Please select meeting date, meeting hour, meeting minute, and AM/PM.",
    );
    expect(validateScheduleDateTime(at("10", "01", "2026", "", "00", ""))).toBe(
      "Please select meeting hour and AM/PM.",
    );
    expect(validateScheduleDateTime(at("10", "01", "2026", "3", "", "PM"))).toBe(
      "Please select a meeting minute.",
    );
    expect(validateScheduleDateTime(at("10", "01", "202", "3", "00", "PM"))).toBe(
      "Please select a meeting date.",
    );
    expect(validateScheduleDateTime(at("", "01", "2026", "3", "00", "PM"))).toBe(
      "Please select a meeting date.",
    );
    expect(validateScheduleDateTime(at("10", "", "2026", "3", "00", "PM"))).toBe(
      "Please select a meeting date.",
    );
  });

  test("the same month and day next year is too far ahead, not past", () => {
    const tooFar = "Meeting date cannot be more than 3 months in advance.";
    expect(validateScheduleDateTime(at("09", "29", "2027", "3", "00", "PM"))).toBe(tooFar);
    expect(validateScheduleDateTime(at("09", "30", "2027", "9", "00", "AM"))).toBe(tooFar);
  });

  test("an earlier hour on a later day this month is fine", () => {
    jest.setSystemTime(new Date("2026-09-15T14:00:00Z")); // Sept 15, 10:00 AM Eastern
    expect(validateScheduleDateTime(at("09", "20", "2026", "9", "00", "AM"))).toBe("");
  });

  test.each([
    ["yesterday", at("09", "29", "2026", "3", "00", "PM")],
    ["an earlier month this year", at("08", "31", "2026", "3", "00", "PM")],
    ["last year", at("12", "31", "2025", "3", "00", "PM")],
  ])("rejects %s as past", (_label, meeting) => {
    expect(validateScheduleDateTime(meeting)).toBe("Meeting date cannot be in the past.");
  });

  test("requires a time after now today, to the minute", () => {
    const future = "Meeting time must be in the future.";
    expect(validateScheduleDateTime(at("09", "30", "2026", "9", "59", "AM"))).toBe(future);
    expect(validateScheduleDateTime(at("09", "30", "2026", "10", "00", "AM"))).toBe(future);
    expect(validateScheduleDateTime(at("09", "30", "2026", "10", "01", "AM"))).toBe("");
    // An earlier hour with a later minute is still in the past.
    expect(validateScheduleDateTime(at("09", "30", "2026", "9", "30", "AM"))).toBe(future);
    // A later hour with an earlier minute is fine.
    expect(validateScheduleDateTime(at("09", "30", "2026", "11", "00", "AM"))).toBe("");
    // An earlier hour on a later day is fine.
    expect(validateScheduleDateTime(at("10", "01", "2026", "8", "00", "AM"))).toBe("");
  });

  test("allows up to exactly three months ahead", () => {
    expect(validateScheduleDateTime(at("12", "30", "2026", "10", "00", "AM"))).toBe("");
    expect(validateScheduleDateTime(at("12", "30", "2026", "10", "01", "AM"))).toBe(
      "Meeting date cannot be more than 3 months in advance.",
    );
  });

  test("a date early next year is judged by the window, not treated as past", () => {
    expect(validateScheduleDateTime(at("01", "05", "2027", "3", "00", "PM"))).toBe(
      "Meeting date cannot be more than 3 months in advance.",
    );
    jest.setSystemTime(new Date("2026-11-15T17:00:00Z")); // noon Eastern
    expect(validateScheduleDateTime(at("01", "10", "2027", "3", "00", "PM"))).toBe("");
  });
});
