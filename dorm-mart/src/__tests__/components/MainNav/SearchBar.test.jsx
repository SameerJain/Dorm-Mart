import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchBar from "../../../components/MainNav/SearchBar";
import { apiGetJson, csrfPostJson } from "../../../utils/apiClient";

jest.mock("../../../utils/apiClient", () => ({ apiGetJson: jest.fn(), csrfPostJson: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  apiGetJson.mockResolvedValue({ data: ["desk", "lamp"] });
  csrfPostJson.mockResolvedValue({ success: true });
});

test("saved searches can be rerun and cleared", async () => {
  const onSearch = jest.fn();
  render(<SearchBar userId={1} onSearch={onSearch} />);
  const input = screen.getByRole("searchbox", { name: "Search listings" });
  fireEvent.focus(input);
  fireEvent.click(await screen.findByRole("button", { name: "desk" }));
  expect(onSearch).toHaveBeenCalledWith("desk");
  await waitFor(() => expect(csrfPostJson).toHaveBeenCalledWith(expect.stringMatching(/recent_searches.php$/), { term: "desk" }, expect.objectContaining({ signal: expect.anything() })));
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
  await waitFor(() => expect(csrfPostJson).toHaveBeenLastCalledWith(expect.any(String), { action: "clear" }, expect.objectContaining({ signal: expect.anything() })));
  expect(screen.queryByRole("button", { name: "lamp" })).toBeNull();
});

test("submitting searches saves trimmed terms but skips blank searches", async () => {
  const onSearch = jest.fn();
  render(<SearchBar userId={1} onSearch={onSearch} />);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "  chair  " } });
  fireEvent.submit(input.closest("form"));
  expect(onSearch).toHaveBeenCalledWith("chair");
  await waitFor(() => expect(csrfPostJson).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(input.closest("form"));
  expect(onSearch).toHaveBeenLastCalledWith("");
  expect(csrfPostJson).toHaveBeenCalledTimes(1);
});

test("history failure does not block a search", async () => {
  apiGetJson.mockRejectedValue(new Error("Offline"));
  csrfPostJson.mockRejectedValue(new Error("Offline"));
  const onSearch = jest.fn();
  render(<SearchBar userId={1} onSearch={onSearch} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "desk" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(onSearch).toHaveBeenCalledWith("desk");
  fireEvent.focus(screen.getByRole("searchbox"));
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not save/i);
});

test("Escape closes history without submitting", async () => {
  const onSearch = jest.fn();
  render(<SearchBar userId={1} onSearch={onSearch} />);
  fireEvent.focus(screen.getByRole("searchbox"));
  expect(await screen.findByRole("button", { name: "lamp" })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
  expect(screen.queryByRole("button", { name: "lamp" })).toBeNull();
  expect(onSearch).not.toHaveBeenCalled();
});

test("a slow initial load cannot overwrite a newly submitted search", async () => {
  let finishLoad;
  apiGetJson.mockReturnValue(new Promise((resolve) => { finishLoad = resolve; }));
  render(<SearchBar userId={1} onSearch={jest.fn()} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "chair" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  finishLoad({ data: ["old search"] });
  await waitFor(() => expect(csrfPostJson).toHaveBeenCalledTimes(1));
  fireEvent.focus(screen.getByRole("searchbox"));
  expect(screen.getByRole("button", { name: "chair" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "old search" })).toBeNull();
});

test("a failed clear restores history and explains the failure", async () => {
  csrfPostJson.mockRejectedValue(new Error("Offline"));
  render(<SearchBar userId={1} onSearch={jest.fn()} />);
  fireEvent.focus(screen.getByRole("searchbox"));
  fireEvent.click(await screen.findByRole("button", { name: "Clear history" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not clear/i);
  expect(screen.getByRole("button", { name: "desk" })).toBeInTheDocument();
});

test("guest searches do not read or write account history", () => {
  render(<SearchBar onSearch={jest.fn()} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "chair" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(apiGetJson).not.toHaveBeenCalled();
  expect(csrfPostJson).not.toHaveBeenCalled();
});

test("switching accounts does not display the previous account's history", async () => {
  apiGetJson.mockResolvedValueOnce({ data: ["private desk search"] });
  apiGetJson.mockResolvedValueOnce({ data: ["books"] });
  const { rerender } = render(<SearchBar key={1} userId={1} onSearch={jest.fn()} />);
  fireEvent.focus(screen.getByRole("searchbox"));
  expect(await screen.findByRole("button", { name: "private desk search" })).toBeInTheDocument();
  const oldSignal = apiGetJson.mock.calls[0][1].signal;
  rerender(<SearchBar key={2} userId={2} onSearch={jest.fn()} />);
  fireEvent.focus(screen.getByRole("searchbox"));
  expect(await screen.findByRole("button", { name: "books" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "private desk search" })).toBeNull();
  expect(oldSignal.aborted).toBe(true);
});
