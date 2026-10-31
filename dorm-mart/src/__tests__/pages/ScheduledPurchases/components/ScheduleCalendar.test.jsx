import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ScheduleDateTimeFields from "../../../../pages/ScheduledPurchases/components/ScheduleDateTimeFields";

// The real form keeps these values in useSchedulePurchaseForm; this holds them
// the same way so both pickers read and write shared state.
function Harness({ onSubmit = () => {} }) {
  const [state, setState] = useState({
    meetingAmPm: "", meetingDay: "", meetingHour: "",
    meetingMinute: "", meetingMonth: "", meetingYear: "",
  });
  const set = (key) => (value) => setState((prev) => ({ ...prev, [key]: value }));
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <ScheduleDateTimeFields
        {...state}
        setDateTimeError={() => {}}
        setMeetingAmPm={set("meetingAmPm")}
        setMeetingDay={set("meetingDay")}
        setMeetingHour={set("meetingHour")}
        setMeetingMinute={set("meetingMinute")}
        setMeetingMonth={set("meetingMonth")}
        setMeetingYear={set("meetingYear")}
      />
    </form>
  );
}

function freezeNow(isoInstant) {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date(isoInstant));
}

const day = (label) => screen.getByRole("button", { name: label });
const openCalendar = () => fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

beforeEach(() => freezeNow("2026-11-20T15:00:00Z")); // 10:00 Friday, Nov 20 Eastern
afterEach(() => jest.useRealTimers());

test("the calendar is an option that replaces the date dropdowns and keeps the time fields", () => {
  render(<Harness />);
  expect(screen.getByRole("button", { name: "Dropdowns", pressed: true })).toBeTruthy();
  expect(screen.getByLabelText("Month")).toBeTruthy();

  openCalendar();

  expect(screen.getByRole("button", { name: "Calendar", pressed: true })).toBeTruthy();
  expect(screen.getByRole("table", { name: "November 2026" })).toBeTruthy();
  expect(screen.queryByLabelText("Month")).toBeNull();
  expect(screen.getByLabelText("Hour")).toBeTruthy();
  expect(screen.getByLabelText("AM/PM")).toBeTruthy();
});

test("only days inside the three-month window can be picked", () => {
  render(<Harness />);
  openCalendar();

  expect(day("Thursday, November 19, 2026").disabled).toBe(true);
  expect(day("Friday, November 20, 2026").disabled).toBe(false);
  expect(day("Friday, November 20, 2026").getAttribute("aria-current")).toBe("date");
  expect(screen.getByRole("button", { name: "Previous month" }).disabled).toBe(true);

  const next = screen.getByRole("button", { name: "Next month" });
  fireEvent.click(next);
  fireEvent.click(next);
  fireEvent.click(next);
  expect(screen.getByRole("table", { name: "February 2027" })).toBeTruthy();
  expect(day("Saturday, February 20, 2027").disabled).toBe(false);
  expect(day("Sunday, February 21, 2027").disabled).toBe(true);
  expect(next.disabled).toBe(true);
});

test("picking a day fills the same month, day and year the dropdowns use", () => {
  render(<Harness />);
  openCalendar();
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  fireEvent.click(day("Saturday, December 5, 2026"));

  expect(day("Saturday, December 5, 2026").getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Selected: Saturday, December 5, 2026")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Dropdowns" }));
  expect(screen.getByLabelText("Month").value).toBe("12");
  expect(screen.getByLabelText("Day").value).toBe("05");
  expect(screen.getByLabelText("Year").value).toBe("2026");
});

test("the calendar opens on a date already chosen with the dropdowns", () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2027" } });
  fireEvent.change(screen.getByLabelText("Month"), { target: { value: "01" } });
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });

  openCalendar();

  expect(screen.getByRole("table", { name: "January 2027" })).toBeTruthy();
  expect(day("Friday, January 15, 2027").getAttribute("aria-pressed")).toBe("true");
  expect(day("Friday, January 15, 2027").tabIndex).toBe(0);
});

test("arrow keys move between days and months but stop at the window edge", () => {
  render(<Harness />);
  openCalendar();
  const today = day("Friday, November 20, 2026");
  expect(today.tabIndex).toBe(0);
  act(() => today.focus());

  fireEvent.keyDown(today, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(today);

  fireEvent.keyDown(document.activeElement, { key: "ArrowRight" });
  expect(document.activeElement).toBe(day("Saturday, November 21, 2026"));

  fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
  expect(document.activeElement).toBe(day("Saturday, November 28, 2026"));

  fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
  expect(screen.getByRole("table", { name: "December 2026" })).toBeTruthy();
  expect(document.activeElement).toBe(day("Saturday, December 5, 2026"));
  expect(document.activeElement.tabIndex).toBe(0);
});

test("today follows Eastern time, not the device's UTC date", () => {
  freezeNow("2026-11-21T03:30:00Z"); // still 10:30 PM on Nov 20 in Buffalo
  render(<Harness />);
  openCalendar();
  expect(day("Friday, November 20, 2026").disabled).toBe(false);
  expect(day("Friday, November 20, 2026").getAttribute("aria-current")).toBe("date");
  expect(day("Thursday, November 19, 2026").disabled).toBe(true);
});

test("the picker's buttons never submit the surrounding form", () => {
  const onSubmit = jest.fn();
  render(<Harness onSubmit={onSubmit} />);
  openCalendar();
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
  fireEvent.click(day("Monday, November 23, 2026"));
  fireEvent.click(screen.getByRole("button", { name: "Dropdowns" }));
  expect(onSubmit).not.toHaveBeenCalled();
});
