import { fireEvent, render, screen } from "@testing-library/react";
import SearchFiltersSidebar from "./SearchFiltersSidebar";

test("applies filter state through the existing listings URL", () => {
  const navigate = jest.fn();
  const onApplied = jest.fn();
  render(
    <SearchFiltersSidebar
      categories={["Decor", "Lighting"]}
      query={new URLSearchParams("q=lamp")}
      includeDescription={false}
      onToggleIncludeDescription={jest.fn()}
      navigate={navigate}
      onApplied={onApplied}
    />,
  );

  fireEvent.click(screen.getByLabelText("Decor"));
  fireEvent.click(screen.getByLabelText("Newest → Oldest"));
  fireEvent.change(screen.getByPlaceholderText("Min"), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByPlaceholderText("Max"), {
    target: { value: "20" },
  });
  fireEvent.click(screen.getByLabelText("Price Negotiable"));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(navigate).toHaveBeenCalledWith(
    "/app/listings?search=lamp&categories=Decor&sort=new&minPrice=5" +
      "&maxPrice=20&priceNego=1",
  );
  expect(onApplied).toHaveBeenCalledTimes(1);
});
