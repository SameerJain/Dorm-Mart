import { act, fireEvent, render, screen } from "@testing-library/react";
import ReviewImageGallery from "../../../../pages/Reviews/components/ReviewImageGallery";

jest.mock("../../../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
}));

const review = { image1_url: "/media/review-images/review_u2_test.jpg" };

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("a failed download shows a popup instead of a browser alert", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  render(<ReviewImageGallery review={review} viewMode="seller" />);
  fireEvent.click(screen.getByRole("button", { name: "Download" }));

  const dialog = await screen.findByRole("dialog", { name: "Download failed" });
  expect(dialog.textContent).toContain("Failed to download image. Please try again.");
  expect(window.alert).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the image opens from the keyboard, and Escape closes it and restores focus", () => {
  render(<ReviewImageGallery review={review} viewMode="seller" />);
  const opener = screen.getByRole("button", { name: "Enlarge review attachment 1" });
  opener.focus();
  fireEvent.click(opener);

  expect(screen.getByRole("dialog", { name: "Review image" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  expect(document.body.style.position).toBe("fixed");

  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test("Escape on the failure popup closes only the popup, not the lightbox under it", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  render(<ReviewImageGallery review={review} viewMode="seller" />);
  fireEvent.click(screen.getByRole("button", { name: "Enlarge review attachment 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  await screen.findByRole("dialog", { name: "Download failed" });

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Download failed" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Review image" })).toBeTruthy();
});

test("the failure popup stacks above the lightbox opened while the download ran", async () => {
  let failDownload;
  global.fetch = jest.fn(() => new Promise((_, reject) => { failDownload = reject; }));
  render(<ReviewImageGallery review={review} viewMode="seller" />);
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  fireEvent.click(screen.getByAltText("Review attachment 1"));
  const lightbox = screen.getByAltText("Selected review attachment").closest(".fixed");
  expect(lightbox.className).toContain("z-[60]");

  await act(async () => failDownload(new Error("offline")));

  const popup = (await screen.findByRole("dialog", { name: "Download failed" })).parentElement;
  expect(popup.className).toContain("z-[70]");
});
