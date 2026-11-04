import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput, type NumberInputProps } from "./number-input";

let latest: number;
const onValueChange = jest.fn();

function Harness({
  initial = 5,
  ...props
}: Partial<NumberInputProps> & { initial?: number }) {
  const [value, setValue] = useState(initial);
  latest = value;
  return (
    <NumberInput
      {...props}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        setValue(next);
      }}
    />
  );
}

async function setup(props?: Parameters<typeof Harness>[0]) {
  const user = userEvent.setup();
  const view = render(<Harness {...props} />);
  return { user, input: screen.getByRole("spinbutton"), ...view };
}

describe("NumberInput", () => {
  beforeEach(() => onValueChange.mockClear());

  it("passes in-range values through while typing", async () => {
    const { user, input } = await setup({ min: 0 });

    await user.clear(input);
    await user.keyboard("0.5");

    expect(input).toHaveValue(0.5);
    expect(latest).toBe(0.5);
  });

  it("holds below-min keystrokes without committing them", async () => {
    const { user, input } = await setup({ min: 2, max: 20, integer: true });

    await user.clear(input);
    await user.keyboard("1");
    expect(input).toHaveValue(1);
    expect(latest).toBe(5);

    await user.keyboard("2");
    expect(input).toHaveValue(12);
    expect(latest).toBe(12);
  });

  it("clamps to min and max on blur", async () => {
    const { user, input } = await setup({ min: 2, max: 20 });

    await user.clear(input);
    await user.keyboard("99");
    await user.tab();
    expect(input).toHaveValue(20);
    expect(latest).toBe(20);

    await user.clear(input);
    await user.keyboard("1");
    await user.tab();
    expect(input).toHaveValue(2);
    expect(latest).toBe(2);
  });

  it("restores the last valid value when left empty", async () => {
    const { user, input } = await setup({ min: 1 });

    await user.clear(input);
    await user.tab();

    expect(input).toHaveValue(5);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("treats 0 as a real value", async () => {
    const { user, input } = await setup({ min: 0 });

    await user.clear(input);
    await user.keyboard("0");
    await user.tab();

    expect(input).toHaveValue(0);
    expect(latest).toBe(0);
  });

  it("drops the fraction for integer fields", async () => {
    const { user, input } = await setup({ integer: true });

    await user.clear(input);
    await user.keyboard("7.9");
    await user.tab();

    expect(input).toHaveValue(7);
    expect(latest).toBe(7);
  });

  it("leaves an untouched out-of-range value alone on blur", async () => {
    const { user, input } = await setup({ initial: 25, max: 20 });

    await user.click(input);
    await user.tab();

    expect(input).toHaveValue(25);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows a new value from the parent when not being edited", () => {
    const { rerender } = render(
      <NumberInput value={1} onValueChange={jest.fn()} />
    );

    rerender(<NumberInput value={9} onValueChange={jest.fn()} />);

    expect(screen.getByRole("spinbutton")).toHaveValue(9);
  });

  it("still calls a caller-supplied onBlur", async () => {
    const onBlur = jest.fn();
    const { user, input } = await setup({ onBlur });

    await user.click(input);
    await user.tab();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
