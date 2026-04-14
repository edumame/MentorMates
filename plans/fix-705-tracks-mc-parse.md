# fix: parse multiple-choice questions on tracks page (#705)

## Root cause
The new tracks page (`CompactScoringForm`) was ported from the old `ScoringConfigForm`
but dropped the question type selector and options editor. Existing criteria with
`type: "multiplechoice"` round-trip through state, but the UI:
1. Provides no way to set `type` to `multiplechoice` on new criteria.
2. Renders MC criteria with only numeric min/max inputs, hiding their `options[]`.
3. `sanitizeCriterion` strips `options` when type isn't `multiplechoice`; but since
   type can never be flipped in the UI, options never get authored.

## Fix
In `CompactScoringForm.tsx` CriterionEditor:
1. Add Question Type Select (Numeric | Multiple Choice) -> updateCriterion({ type }).
2. If type === "multiplechoice": render Options list (add/remove/edit).
3. Else: keep existing min/max range inputs.

Keep sanitizeCriterion as-is. No changes to render side (QuestionFactory works).
