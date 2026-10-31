import { fireEvent, render, screen } from "@testing-library/react";
import { MessageDialog } from "../../components/Dialog";

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("shows the message in a labelled dialog with the OK button focused", () => {
  render(
    <MessageDialog title="Download failed" message="Please try again." onClose={() => {}} />,
  );
  const dialog = screen.getByRole("dialog", { name: "Download failed" });
  const description = document.getElementById(dialog.getAttribute("aria-describedby"));
  expect(description.textContent).toBe("Please try again.");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "OK" }));
});

test("locks page scroll while open and restores it on close", () => {
  expect(document.body.style.position).toBe("");
  const { unmount } = render(<MessageDialog title="Notice" message="Hi" onClose={() => {}} />);
  expect(document.body.style.position).toBe("fixed");
  expect(document.documentElement.style.overflow).toBe("hidden");
  unmount();
  expect(document.body.style.position).toBe("");
  expect(document.documentElement.style.overflow).toBe("");
});

test("OK, Escape and the backdrop each close it", () => {
  const onClose = jest.fn();
  render(<MessageDialog title="Notice" message="Hi" onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("dialog").parentElement);
  expect(onClose).toHaveBeenCalledTimes(3);
});

test("clicks inside the panel do not close it", () => {
  const onClose = jest.fn();
  render(<MessageDialog title="Notice" message="Hi" onClose={onClose} />);
  fireEvent.click(screen.getByText("Hi"));
  expect(onClose).not.toHaveBeenCalled();
});

test("sits above the app's other overlays and widens its button on phones", () => {
  render(<MessageDialog title="Notice" message="Hi" onClose={() => {}} />);
  expect(screen.getByRole("dialog").parentElement.className).toContain("z-[70]");
  const button = screen.getByRole("button", { name: "OK" }).className.split(/\s+/);
  expect(button).toEqual(expect.arrayContaining(["w-full", "sm:w-auto", "coarse:min-h-[44px]"]));
});
