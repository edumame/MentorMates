import React from "react";
import "@testing-library/jest-dom";
import "jest-axe/extend-expect";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    // eslint-disable-next-line @next/next/no-img-element
    React.createElement("img", props),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement(
      "a",
      { href: href?.toString(), ...rest },
      children,
    ),
}));
