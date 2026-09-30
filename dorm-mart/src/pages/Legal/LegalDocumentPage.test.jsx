import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LegalDocumentPage, { sectionId } from "./LegalDocumentPage";
import { legalDocuments } from "./legalDocuments";

const mockNavigate = jest.fn();
jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  }),
  { virtual: true },
);

describe("LegalDocumentPage", () => {
  test("sets the tab title and restores it on unmount", () => {
    document.title = "Dorm Mart";
    const { unmount } = render(<LegalDocumentPage documentKey="privacy" />);
    expect(document.title).toBe("Privacy Policy | Dorm Mart");
    unmount();
    expect(document.title).toBe("Dorm Mart");
  });

  test("lists every section in the table of contents", () => {
    render(<LegalDocumentPage documentKey="terms" />);
    const nav = screen.getByRole("navigation", { name: "Contents" });
    const sections = legalDocuments.terms.sections;
    expect(nav.querySelectorAll("li")).toHaveLength(sections.length);
    expect(document.getElementById(sectionId(sections[0].title))).toBeInTheDocument();
  });

  test("offers a PDF download through the print dialog", () => {
    const print = jest.spyOn(window, "print").mockImplementation(() => {});
    render(<LegalDocumentPage documentKey="privacy" />);
    fireEvent.click(screen.getByRole("button", { name: /download or print/i }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  test("shows a message instead of crashing for an unknown document", () => {
    render(<LegalDocumentPage documentKey="nope" />);
    expect(screen.getByText(/could not be found/i)).toBeInTheDocument();
  });

  test("policy text matches how account deletion actually works", () => {
    const text = JSON.stringify(legalDocuments);
    expect(text).not.toMatch(/DELETE MY ACCOUNT/);
    expect(text).toMatch(/typing your account email/);
  });
});

test("section ids are stable slugs", () => {
  expect(sectionId("1. What this covers")).toBe("legal-1-what-this-covers");
});
