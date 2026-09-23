import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ItemFactsPanel from "./ItemFactsPanel";

test("renders a clickable mailto link for the seller email", () => {
  render(
    <ItemFactsPanel
      normalized={{
        itemLocation: "North Campus",
        itemCondition: "Good",
        priceNego: false,
        trades: false,
        sellerEmail: "seller@buffalo.edu",
        dateListed: "2026-01-01",
      }}
    />,
  );

  const link = screen.getByRole("link", { name: "seller@buffalo.edu" });
  expect(link).toHaveAttribute("href", "mailto:seller@buffalo.edu");
});

test("shows a placeholder instead of a link when there is no seller email", () => {
  render(
    <ItemFactsPanel
      normalized={{
        itemLocation: "North Campus",
        itemCondition: "Good",
        priceNego: false,
        trades: false,
        sellerEmail: "",
        dateListed: "2026-01-01",
      }}
    />,
  );

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
