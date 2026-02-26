import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { FeaturesHeader } from "../sections/FeaturesHeader";
import { DefineDeploySection } from "../sections/DefineDeploySection";
import { ScaleMentorshipSection } from "../sections/ScaleMentorshipSection";
import { IdeaToDemoCta } from "../sections/IdeaToDemoCta";

describe("Host sections", () => {
  it("renders the features header", () => {
    render(<FeaturesHeader />);
    expect(
      screen.getByRole("heading", { name: /features & benefits/i })
    ).toBeInTheDocument();
  });

  it("renders the Define & Deploy section content", () => {
    render(<DefineDeploySection />);
    expect(
      screen.getByRole("heading", { name: /define & deploy/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /book a demo/i })
    ).toHaveAttribute("href", expect.stringContaining("calendly"));
  });

  it("renders the Scale Your Mentorship section content", () => {
    render(<ScaleMentorshipSection />);
    expect(
      screen.getByRole("heading", { name: /scale your mentorship/i })
    ).toBeInTheDocument();
  });

  it("renders the CTA section content", () => {
    render(<IdeaToDemoCta />);
    expect(
      screen.getByRole("heading", {
        name: /from idea to demo day in 3 steps/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /host your first event free/i })
    ).toHaveAttribute("href", "/login");
  });

  it("has no basic accessibility violations", async () => {
    const { container } = render(
      <div>
        <FeaturesHeader />
        <DefineDeploySection />
        <ScaleMentorshipSection />
        <IdeaToDemoCta />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
