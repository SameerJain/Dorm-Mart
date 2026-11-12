import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
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

test("picking a category still adds it", () => {
  const props = renderForm();
  fireEvent.change(screen.getByLabelText(/^Categories/), { target: { value: "Electronics" } });
  expect(props.setCategories).toHaveBeenCalledWith(["Textbooks", "Electronics"]);
  expect(props.clearError).toHaveBeenCalledWith("categories");
});

test("a photo error is announced", () => {
  renderForm({ errors: { images: "Add at least one photo" } });
  expect(screen.getByText("Add at least one photo")).toBeInTheDocument();
});
