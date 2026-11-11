import React from "react";
import { TextDecoder, TextEncoder } from "node:util";
import "@testing-library/jest-dom";
import "jest-axe/extend-expect";

// jsdom does not expose these Web APIs used by server/client libraries.
if (typeof globalThis.TextEncoder === "undefined") {
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true, writable: true });
}
if (typeof globalThis.TextDecoder === "undefined") {
  Object.defineProperty(globalThis, "TextDecoder", { value: TextDecoder, configurable: true, writable: true });
}

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
    prefetch: _prefetch,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string;
    prefetch?: boolean;
  }) =>
    React.createElement(
      "a",
      { href: href?.toString(), ...rest },
      children,
    ),
}));
