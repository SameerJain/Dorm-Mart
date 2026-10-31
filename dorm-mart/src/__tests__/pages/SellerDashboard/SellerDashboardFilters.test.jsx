import { fireEvent, render, screen } from "@testing-library/react";
import SellerDashboardFilters from "../../../pages/SellerDashboard/components/SellerDashboardFilters";

test("each filter select is named by its label and reports changes", () => {
  const onStatusChange = jest.fn();
  const onCategoryChange = jest.fn();
  const onSortChange = jest.fn();
  render(
    <SellerDashboardFilters
      categories={["Books", "Electronics"]}
      selectedCategory="All Categories"
      selectedSort="Newest First"
      selectedStatus="All Status"
      onCategoryChange={onCategoryChange}
      onSortChange={onSortChange}
      onStatusChange={onStatusChange}
    />,
  );

  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Sold" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Books" } });
  fireEvent.change(screen.getByLabelText("Sort By"), { target: { value: "Price: Low to High" } });

  expect(onStatusChange).toHaveBeenCalledWith("Sold");
  expect(onCategoryChange).toHaveBeenCalledWith("Books");
  expect(onSortChange).toHaveBeenCalledWith("Price: Low to High");
});
