import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RemoveWishlistItemModal from "./RemoveWishlistItemModal";

test("blocks duplicate removal while the request is running", () => {
  const onConfirm = jest.fn();
  render(
    <RemoveWishlistItemModal
      item={{ id: 7, title: "Desk lamp" }}
      removing={true}
      onCancel={jest.fn()}
      onConfirm={onConfirm}
    />,
  );

  const removeButton = screen.getByRole("button", { name: "Removing..." });
  expect(removeButton).toBeDisabled();
  fireEvent.click(removeButton);
  expect(onConfirm).not.toHaveBeenCalled();
});
