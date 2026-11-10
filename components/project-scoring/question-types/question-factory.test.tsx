import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form, FormField } from "@/components/ui/form";
import { QuestionFactory } from "./question-factory";
import { normalizeCriterion } from "@/lib/judging/scoring-config";

// Radix Slider measures itself; jsdom has no ResizeObserver.
beforeAll(() => {
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function Harness({ value }: { value: number }) {
  const form = useForm({ defaultValues: { v: value } });
  const criterion = normalizeCriterion({ id: "yn", name: "Ready?", description: "", type: "numeric", min: 0, max: 1 });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="v"
        render={({ field }) => (
          <QuestionFactory criterion={criterion} value={field.value} onChange={field.onChange} />
        )}
      />
    </Form>
  );
}

it("renders a Yes/No (0..1) slider starting at 0 after normalization", () => {
  render(<Harness value={0} />);
  const slider = screen.getByRole("slider");
  expect(slider).toHaveAttribute("aria-valuemin", "0");
  expect(slider).toHaveAttribute("aria-valuemax", "1");
  expect(slider).toHaveAttribute("aria-valuenow", "0");
});
