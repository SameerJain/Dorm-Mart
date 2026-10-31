import { fireEvent, render, screen } from "@testing-library/react";
import MeetLocationField from "../../../pages/ScheduledPurchases/components/MeetLocationField";
import NegotiationFields from "../../../pages/ScheduledPurchases/components/NegotiationFields";
import ScheduleDateTimeFields from "../../../pages/ScheduledPurchases/components/ScheduleDateTimeFields";

const noop = () => {};

test("the meet location select is named by its label", () => {
  const setChoice = jest.fn();
  render(
    <MeetLocationField
      customMeetLocation=""
      meetLocationChoice=""
      selectedListing={null}
      setCustomMeetLocation={noop}
      setMeetLocationChoice={setChoice}
    />,
  );
  const select = screen.getByLabelText(/Meet Location/);
  expect(select.tagName).toBe("SELECT");
  fireEvent.change(select, { target: { value: "North Campus" } });
  expect(setChoice).toHaveBeenCalledWith("North Campus");
});

test("the negotiated price and trade fields are named by their labels", () => {
  render(
    <NegotiationFields
      isTrade
      negotiatedPrice=""
      selectedListing={{ priceNegotiable: true, acceptTrades: true, price: 20 }}
      setIsTrade={noop}
      setNegotiatedPrice={noop}
      setTradeItemDescription={noop}
      tradeItemDescription=""
    />,
  );
  expect(screen.getByLabelText("Negotiated Price (Optional)").tagName).toBe("INPUT");
  expect(screen.getByLabelText(/Item You Are Trading For/).tagName).toBe("TEXTAREA");
});

test("the meeting date and time selects form one labelled group", () => {
  render(
    <ScheduleDateTimeFields
      meetingAmPm=""
      meetingDay=""
      meetingHour=""
      meetingMinute=""
      meetingMonth=""
      meetingYear=""
      setDateTimeError={noop}
      setMeetingAmPm={noop}
      setMeetingDay={noop}
      setMeetingHour={noop}
      setMeetingMinute={noop}
      setMeetingMonth={noop}
      setMeetingYear={noop}
    />,
  );
  const group = screen.getByRole("group", { name: /Meeting Date & Time/ });
  for (const label of ["Month", "Day", "Hour", "Minute", "AM/PM"]) {
    const select = screen.getByLabelText(label);
    expect(select.tagName).toBe("SELECT");
    expect(group.contains(select)).toBe(true);
  }
});
