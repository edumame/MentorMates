// Minimal declarations for the jest-axe API used by this test suite.
declare module "jest-axe" {
  export function axe(html: Element | string): Promise<{
    violations: readonly unknown[];
  }>;
}

declare namespace jest {
  interface Matchers<R> {
    toHaveNoViolations(): R;
  }
}
