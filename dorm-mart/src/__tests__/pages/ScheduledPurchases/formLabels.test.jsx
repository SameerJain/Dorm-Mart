import { fireEvent, render, screen } from "@testing-library/react";
import MeetLocationField from "../../../pages/ScheduledPurchases/components/MeetLocationField";

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
  fireEvent.change(select, { target: { value: "North Campus" } });
  expect(setChoice).toHaveBeenCalledWith("North Campus");
});
