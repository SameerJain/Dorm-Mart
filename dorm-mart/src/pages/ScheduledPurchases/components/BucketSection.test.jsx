import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BucketSection from "./BucketSection";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => {
      const anchorProps = { ...props };
      delete anchorProps.state;
      return (
        <a href={to} {...anchorProps}>
          {children}
        </a>
      );
    },
  }),
  { virtual: true },
);

const purchaseCardProps = {
  actionError: "",
  busyRequestId: 0,
  onAction: jest.fn(),
  onCancel: jest.fn(),
  onOpenPurchaseHistory: jest.fn(),
};

function renderSection(request, bucketKey) {
  render(
    <BucketSection
      title="Purchases"
      bucketKey={bucketKey}
      groupedByItem={[
        {
          productId: 42,
          item: { title: "Desk Lamp", photos: [] },
          buckets: { [bucketKey]: [request] },
        },
      ]}
      purchaseCardProps={purchaseCardProps}
    />,
  );
}

test("links a completed purchase image and title to its receipt", () => {
  renderSection(
    {
      request_id: 7,
      inventory_product_id: 42,
      perspective: "buyer",
      status: "accepted",
      has_completed_confirm: true,
      has_unsuccessful_confirm: false,
      item: {},
    },
    "past",
  );

  expect(screen.getByRole("link", { name: "Desk Lamp" })).toHaveAttribute(
    "href",
    "/app/viewReceipt?id=42",
  );
});

test("keeps an incomplete purchase image and title non-clickable", () => {
  renderSection(
    {
      request_id: 8,
      inventory_product_id: 42,
      perspective: "buyer",
      status: "pending",
      has_completed_confirm: false,
      has_unsuccessful_confirm: false,
      item: {},
    },
    "upcoming",
  );

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
