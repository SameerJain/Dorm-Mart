import { render, screen, within } from "@testing-library/react";
import AboutUs from "./AboutUs";

jest.mock("./SettingsLayout", () => ({ children }) => <div>{children}</div>);

test("shows each developer and their contact links", () => {
  render(<AboutUs />);

  [
    {
      name: "Sameer Jain",
      email: "sameerjain501@gmail.com",
      linkedin: "https://www.linkedin.com/in/sameer-jain1/",
    },
    {
      name: "Anish Banerjee",
      email: "anishbancse312@gmail.com",
      linkedin: "https://www.linkedin.com/in/anish-banerjee-71aba9290/",
    },
    {
      name: "Chris Kim",
      email: "sooseokkim99@gmail.com",
      linkedin: "https://www.linkedin.com/in/kim-chris-sooseok/",
    },
  ].forEach(({ name, email, linkedin }) => {
    const card = screen.getByRole("heading", { name }).closest("article");
    const cardContent = within(card);

    expect(cardContent.getByRole("img", { name: new RegExp(name) })).toBeTruthy();
    expect(cardContent.getByRole("link", { name: email }).getAttribute("href")).toBe(
      `mailto:${email}`,
    );
    expect(
      cardContent.getByRole("link", { name: "LinkedIn" }).getAttribute("href"),
    ).toBe(linkedin);
  });

  expect(screen.getAllByRole("link", { name: "Email" })).toHaveLength(3);
  expect(screen.getAllByRole("link", { name: "LinkedIn" })).toHaveLength(3);
  expect(screen.getAllByRole("link", { name: "GitHub" })).toHaveLength(3);
});
