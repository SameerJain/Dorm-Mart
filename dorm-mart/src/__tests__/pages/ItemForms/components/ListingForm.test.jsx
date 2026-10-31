import { fireEvent, render, screen, within } from "@testing-library/react";
import ListingForm from "../../../../pages/ItemForms/components/ListingForm";

function renderForm(overrides = {}) {
  const props = {
    acceptTrades: false,
    atListingCap: false,
    catFetchError: "",
    catLoading: false,
    categories: ["Textbooks"],
    clearError: jest.fn(),
    condition: "",
    description: "",
    errors: {},
    fileInputRef: { current: null },
    formTopRef: { current: null },
    handleInputChange: jest.fn(),
    images: [],
    isEdit: false,
    isNew: true,
    itemLocation: "",
    loadingExisting: false,
    listingStatus: "",
    location: { state: {} },
    navigate: jest.fn(),
    onFileChange: jest.fn(),
    price: "",
    priceNegotiable: false,
    publishListing: jest.fn(),
    removeCategory: jest.fn(),
    removeImage: jest.fn(),
    scrollPositionRef: { current: 0 },
    selectableOptions: ["Electronics", "Furniture"],
    selectedCategory: "",
    saveDraft: jest.fn(),
    setAcceptTrades: jest.fn(),
    setCategories: jest.fn(),
    setCondition: jest.fn(),
    setDescription: jest.fn(),
    setErrors: jest.fn(),
    setItemLocation: jest.fn(),
    setPrice: jest.fn(),
    setPriceNegotiable: jest.fn(),
    setSelectedCategory: jest.fn(),
    setTitle: jest.fn(),
    showTopErrorBanner: false,
    submitting: false,
    title: "",
    ...overrides,
  };
  render(<ListingForm {...props} />);
  return props;
}

const box = (name) =>
  screen.getByRole("heading", { level: 2, name: new RegExp(`^${name}`) }).closest("section");

test("basic information, location, pricing and photos are each their own box", () => {
  renderForm();
  const basic = box("Basic Information");
  const location = box("Location");
  const pricing = box("Pricing");
  const photos = box("Photos and Videos");
  expect(new Set([basic, location, pricing, photos]).size).toBe(4);

  for (const label of [/^Item Title/, /^Item Condition/, /^Categories/, /^Description/]) {
    expect(within(basic).getByLabelText(label)).toBeTruthy();
  }
  expect(within(location).getByLabelText(/^Item Location/)).toBeTruthy();
  for (const label of [/^Price \*/, /Accepting Trades/, /Price Negotiable/]) {
    expect(within(pricing).getByLabelText(label)).toBeTruthy();
  }
  expect(within(photos).getByRole("button", { name: "+ Add a Photo" })).toBeTruthy();
  expect(within(pricing).queryByLabelText(/^Item Location/)).toBeNull();
  expect(within(location).queryByLabelText(/^Price \*/)).toBeNull();
});

test("the boxes come in order: basic information, location, pricing, photos", () => {
  renderForm();
  const order = ["Basic Information", "Location", "Pricing", "Photos and Videos"].map(box);
  for (let i = 1; i < order.length; i += 1) {
    expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

test("item condition and categories sit in the same row", () => {
  renderForm();
  const condition = screen.getByLabelText(/^Item Condition/);
  const categories = screen.getByLabelText(/^Categories/);
  const row = condition.closest(".grid");
  expect(row).toBe(categories.closest(".grid"));
  expect(row.className).toContain("md:grid-cols-2");
});

test("the trade and negotiation toggles sit side by side under the price", () => {
  renderForm();
  const row = screen.getByLabelText(/Accepting Trades/).closest(".grid");
  expect(row).toBe(screen.getByLabelText(/Price Negotiable/).closest(".grid"));
  expect(row.className).toContain("md:grid-cols-2");
});

test("picking a category still adds it", () => {
  const props = renderForm();
  fireEvent.change(screen.getByLabelText(/^Categories/), { target: { value: "Electronics" } });
  expect(props.setCategories).toHaveBeenCalledWith(["Textbooks", "Electronics"]);
  expect(props.clearError).toHaveBeenCalledWith("categories");
});

test("a photo error outlines only the photos box", () => {
  renderForm({ errors: { images: "Add at least one photo" } });
  expect(box("Photos and Videos").className).toContain("border-red-500");
  expect(box("Basic Information").className).not.toContain("border-red-500");
  expect(screen.getByText("Add at least one photo")).toBeTruthy();
});

test("the publish buttons come after the safety tips on small screens", () => {
  renderForm();
  const actions = screen.getByRole("heading", { name: "Publish Your Listing" }).parentElement;
  const tips = screen.getByRole("heading", { name: "Safety Tips" }).parentElement;
  expect(actions.parentElement).toBe(tips.parentElement);
  expect(actions.className).toContain("order-2");
  expect(tips.className).toContain("order-1");
  expect(screen.getByRole("button", { name: "Publish Listing" })).toBeTruthy();
});
