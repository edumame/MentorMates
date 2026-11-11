import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundScoringConfigDialog } from "./round-scoring-config-dialog";
import type { TrackScoringConfig } from "@/lib/types";

const baseTracks: Record<string, TrackScoringConfig> = {
  main: {
    name: "Main",
    criteria: [
      {
        id: "impact",
        name: "Impact",
        description: "",
        type: "numeric",
        weight: 2,
        min: 1,
        max: 10,
      },
    ],
  },
};

function renderDialog() {
  const onSave = jest.fn();
  render(
    <RoundScoringConfigDialog
      open
      onOpenChange={jest.fn()}
      roundNumber={1}
      roundName="Finals"
      baseTracks={baseTracks}
      onSave={onSave}
      onResetToDefault={jest.fn()}
    />
  );
  const [weight, minScore, maxScore] = screen.getAllByRole("spinbutton");
  return { onSave, weight, minScore, maxScore };
}

async function replaceValue(
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  text: string
) {
  await user.clear(input);
  await user.keyboard(text);
}

describe("RoundScoringConfigDialog numeric inputs", () => {
  it("accepts a fractional weight typed one key at a time", async () => {
    const user = userEvent.setup();
    const { onSave, weight } = renderDialog();

    await replaceValue(user, weight, "0.5");
    expect(weight).toHaveValue(0.5);

    await user.click(screen.getByRole("button", { name: "Apply Round Rubric" }));
    expect(onSave.mock.calls[0][0].main.criteria[0].weight).toBe(0.5);
  });

  it("keeps a weight of 0", async () => {
    const user = userEvent.setup();
    const { onSave, weight } = renderDialog();

    await replaceValue(user, weight, "0");
    expect(weight).toHaveValue(0);

    await user.click(screen.getByRole("button", { name: "Apply Round Rubric" }));
    expect(onSave.mock.calls[0][0].main.criteria[0].weight).toBe(0);
  });

  it("lets Max Score be cleared and retyped", async () => {
    const user = userEvent.setup();
    const { onSave, maxScore } = renderDialog();

    await user.clear(maxScore);
    expect(maxScore).toHaveValue(null);

    await user.keyboard("25");
    expect(maxScore).toHaveValue(25);

    await user.click(screen.getByRole("button", { name: "Apply Round Rubric" }));
    expect(onSave.mock.calls[0][0].main.criteria[0].max).toBe(25);
  });

  it("restores the last valid value when a field is left empty at save", async () => {
    const user = userEvent.setup();
    const { onSave, maxScore, weight } = renderDialog();

    await user.clear(maxScore);
    await user.clear(weight);
    await user.click(screen.getByRole("button", { name: "Apply Round Rubric" }));

    expect(onSave.mock.calls[0][0].main.criteria[0]).toMatchObject({
      weight: 2,
      max: 10,
    });
  });
});
