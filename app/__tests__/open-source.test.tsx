import * as fs from "fs";
import * as path from "path";
import { render, screen } from "@testing-library/react";
import { OPEN_SOURCE } from "@/lib/config/open-source";
import { OpenSource } from "@/components/about/OpenSource";
import { LicenseNotice } from "@/components/layout/LicenseNotice";
import { readLicenseText } from "@/lib/license";

const rootFile = (name: string) => fs.readFileSync(path.join(__dirname, "..", "..", name), "utf8");

describe("open source licensing", () => {
  it("ships an MIT LICENSE naming the copyright holder", () => {
    const license = rootFile("LICENSE");
    expect(license.startsWith("MIT License")).toBe(true);
    expect(license).toContain(OPEN_SOURCE.COPYRIGHT_HOLDER);
    expect(license).toContain("WITHOUT WARRANTY OF ANY KIND");
  });

  it("declares MIT in package.json", () => {
    expect(JSON.parse(rootFile("package.json")).license).toBe("MIT");
  });

  it("states the license in the README without a non-profit claim", () => {
    const readme = rootFile("README.md");
    expect(readme).toContain(OPEN_SOURCE.LICENSE_NAME);
    expect(readme).not.toMatch(/non[\s-]?profit|registering as/i);
    expect(readme).toContain(OPEN_SOURCE.CONTACT_EMAIL);
  });

  it("the license page reads the repo's LICENSE file", () => {
    expect(readLicenseText()).toBe(rootFile("LICENSE"));
  });

  it("the about page section shows open source and MIT without a non-profit claim", () => {
    const { container } = render(<OpenSource />);
    expect(screen.getByRole("heading", { name: /open source/i })).toBeInTheDocument();
    expect(container).toHaveTextContent("MentorMates is open source under the MIT License. We build in the open");
    expect(container.textContent).not.toMatch(/non[\s-]?profit|registering as/i);
    expect(screen.getByRole("link", { name: OPEN_SOURCE.LICENSE_NAME })).toHaveAttribute("href", OPEN_SOURCE.LICENSE_PATH);
    expect(screen.getByRole("link", { name: OPEN_SOURCE.CONTACT_EMAIL })).toHaveAttribute("href", `mailto:${OPEN_SOURCE.CONTACT_EMAIL}`);
  });

  it("the footer notice links the MIT License instead of reserving all rights", () => {
    const { container } = render(<LicenseNotice />);
    expect(screen.getByRole("link", { name: OPEN_SOURCE.LICENSE_NAME })).toHaveAttribute("href", OPEN_SOURCE.LICENSE_PATH);
    expect(container.textContent).not.toMatch(/all rights reserved/i);
  });
});
