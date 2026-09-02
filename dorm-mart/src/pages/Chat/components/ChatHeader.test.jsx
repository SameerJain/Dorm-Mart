import { fireEvent, render, screen } from "@testing-library/react";
import ChatHeader from "./ChatHeader";

const baseProps = {
  activeConvId: 4,
  activeConversation: {},
  activeFirstName: "Seller",
  activeLabel: "Seller Name",
  activeLabelFirstName: "Seller",
  activeLastName: "Name",
  activeReceiverId: 2,
  clearActiveConversation: jest.fn(),
  handleProfileHeaderClick: jest.fn(),
  headerBgColor: "bg-blue-50 border-blue-200",
  isSellerPerspective: false,
  navigate: jest.fn(),
  setIsMobileList: jest.fn(),
};

test("shows contact information shared by the seller", () => {
  render(
    <ChatHeader
      {...baseProps}
      activeConversation={{
        sharedContactEmail: "seller@buffalo.edu",
        sharedContactPhone: "(716) 555-0123",
      }}
    />,
  );

  expect(screen.getByText("Seller contact")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "seller@buffalo.edu" }).getAttribute("href"),
  ).toBe("mailto:seller@buffalo.edu");
  expect(
    screen.getByRole("link", { name: "(716) 555-0123" }).getAttribute("href"),
  ).toBe("tel:7165550123");
});

test("does not render contact information when the seller has not shared it", () => {
  render(<ChatHeader {...baseProps} />);

  expect(screen.queryByText("Seller contact")).toBeNull();
});

test("shows an unavailable banner and hides View Item for a draft", () => {
  render(
    <ChatHeader
      {...baseProps}
      activeConversation={{ productId: 12, productStatus: "Draft" }}
    />,
  );

  expect(screen.getByRole("status").textContent).toContain(
    "currently unavailable",
  );
  expect(screen.queryByRole("button", { name: "View item" })).toBeNull();
});

test("gives the seller an edit and publish shortcut for a draft", () => {
  const navigate = jest.fn();
  render(
    <ChatHeader
      {...baseProps}
      activeConversation={{ productId: 12, productStatus: "Draft" }}
      isSellerPerspective
      navigate={navigate}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Edit / Publish" }));
  expect(navigate).toHaveBeenCalledWith("/app/product-listing/edit/12", {
    state: { returnTo: "/app/chat?conv=4" },
  });
});
