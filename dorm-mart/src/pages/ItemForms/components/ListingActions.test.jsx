import { fireEvent, render, screen } from "@testing-library/react";
import ListingActions from "./ListingActions";

const baseProps = {
  atListingCap: false,
  catFetchError: null,
  catLoading: false,
  isEdit: false,
  isNew: true,
  loadingExisting: false,
  listingStatus: null,
  location: { state: null },
  navigate: jest.fn(),
  publishListing: jest.fn(),
  saveDraft: jest.fn(),
  submitting: false,
};

test("publishes a completed draft from the edit form", () => {
  const publishListing = jest.fn();
  render(
    <ListingActions
      {...baseProps}
      isEdit
      isNew={false}
      listingStatus="Draft"
      publishListing={publishListing}
    />,
  );

  const publishButton = screen.getByRole("button", {
    name: "Publish Listing",
  });
  expect(publishButton.disabled).toBe(false);
  fireEvent.click(publishButton);
  expect(publishListing).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Save as Draft" }).disabled,
  ).toBe(false);
});

test("still allows saving a draft at the active listing limit", () => {
  render(<ListingActions {...baseProps} atListingCap />);

  expect(
    screen.getByRole("button", { name: "Listing Limit Reached" }).disabled,
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Save as Draft" }).disabled,
  ).toBe(false);
});
