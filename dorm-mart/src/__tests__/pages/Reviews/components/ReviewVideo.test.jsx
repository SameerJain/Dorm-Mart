import { fireEvent, render, screen } from "@testing-library/react";
import ReviewVideo from "../../../../pages/Reviews/components/ReviewVideo";

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("opens a review video popup and removes the player on close", () => {
  const { container } = render(<ReviewVideo url="/media/review-images/review_u2_test.webm" />);
  expect(container.querySelector("video")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Play review video" }));
  expect(screen.getByRole("dialog", { name: "Review video" })).toBeTruthy();
  expect(container.querySelector("video").src).toContain("media/image.php?url=");
  fireEvent.click(screen.getByRole("button", { name: "Close video" }));
  expect(container.querySelector("video")).toBeNull();
});

test("Escape closes the popup and returns focus to its opener", () => {
  render(<ReviewVideo url="/media/review-images/review_u2_test.webm" />);
  const opener = screen.getByRole("button", { name: "Play review video" });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
