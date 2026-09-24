import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductImageGallery from "./ProductImageGallery";

const photoUrls = ["/first.jpg", "/second.jpg", "/third.jpg"];

function device(userAgent, maxTouchPoints = 0) {
  jest.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: maxTouchPoints });
}

afterEach(() => jest.restoreAllMocks());

test("desktop end arrows disappear, including on touch desktops", () => {
  device("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 10);
  render(<ProductImageGallery photoUrls={photoUrls} title="Desk" />);
  expect(screen.queryByRole("button", { name: "Previous media" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next media" }));
  expect(screen.getByRole("button", { name: "Previous media" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next media" }));
  expect(screen.queryByRole("button", { name: "Next media" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show media 1" })).not.toBeInTheDocument();
});

test.each(["iPhone", "Android", "Macintosh"])("%s supports dots and bounded swipes", (agent) => {
  device(agent, 5);
  render(<ProductImageGallery photoUrls={photoUrls} title="Desk" />);
  const media = screen.getByAltText("Desk");
  const swipe = (x, y = 100) => {
    fireEvent.touchStart(media, { touches: [{ clientX: 150, clientY: 100 }] });
    fireEvent.touchEnd(media, { changedTouches: [{ clientX: x, clientY: y }] });
  };
  expect(screen.queryByRole("button", { name: "Next media" })).not.toBeInTheDocument();
  swipe(250);
  expect(media).toHaveAttribute("src", "/first.jpg");
  swipe(50, 300);
  expect(media).toHaveAttribute("src", "/first.jpg");
  swipe(50);
  expect(media).toHaveAttribute("src", "/second.jpg");
  expect(screen.getByRole("button", { name: "Show media 2" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "Show media 2" }).firstChild).toHaveClass("bg-blue-600");
  fireEvent.click(screen.getByRole("button", { name: "Show media 3" }));
  swipe(50);
  expect(media).toHaveAttribute("src", "/third.jpg");
  swipe(250);
  expect(media).toHaveAttribute("src", "/second.jpg");
});

test("single image has no navigation", () => {
  device("iPhone", 5);
  render(<ProductImageGallery photoUrls={[photoUrls[0]]} title="Desk" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("videos use the site-styled player instead of native controls", () => {
  device("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  render(<ProductImageGallery photoUrls={["/clip.mp4", "/first.jpg"]} title="Desk" />);
  const video = screen.getByLabelText("Desk");
  expect(video.tagName).toBe("VIDEO");
  expect(video).not.toHaveAttribute("controls");
  expect(screen.getByRole("slider", { name: "Seek video" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Play video" })[0]);
  expect(play).toHaveBeenCalled();
});
