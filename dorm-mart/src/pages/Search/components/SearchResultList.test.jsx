import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchResultList from "./SearchResultList";

test.each([
  [{ loading: true, error: null, items: [] }, "Searching…"],
  [
    { loading: false, error: new Error("failed"), items: [] },
    "Could not fetch search results.",
  ],
  [{ loading: false, error: null, items: [] }, "No items found."],
])("renders the search request state", (state, message) => {
  render(<SearchResultList {...state} onSelectItem={jest.fn()} />);
  expect(screen.getByText(message)).toBeInTheDocument();
});

test("opens the selected search result", () => {
  const onSelectItem = jest.fn();
  render(
    <SearchResultList
      loading={false}
      error={null}
      items={[
        {
          id: 7,
          title: "Desk lamp",
          price: 12,
          img: null,
          seller: "Alex",
          createdAt: null,
          itemCondition: "Good",
          itemLocation: "North Campus",
          status: "AVAILABLE",
        },
      ]}
      onSelectItem={onSelectItem}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /desk lamp/i }));
  expect(onSelectItem).toHaveBeenCalledWith(7);
});
