import {
  applyEffectiveSubmissionToProject,
  buildSubmissionAnswersPayload,
  buildSubmissionFormValues,
  buildSubmissionValuesFromProject,
  findMissingRequiredSubmissionField,
  getSavedUrlRows,
  splitUrlRows,
  type EffectiveSubmissionField,
} from './effectiveSubmission';
import type { Project, ProjectSubmissionAnswer } from '@/lib/types';

const url = 'https://example.com/deck.pdf';
const deck: EffectiveSubmissionField = {
  id: 'deck-field', event_id: 'event-1', key: 'additional_materials',
  label: 'Slide Deck', field_type: 'file', required: true,
  sort_order: 0, is_active: true,
};

describe('required slide deck submission', () => {
  it.each(['file', 'multi_file'] as const)('accepts an uploaded %s deck and restores it in both project views', (field_type) => {
    const field = { ...deck, field_type };
    // Both creation and draft forms store built-in materials as legacy arrays.
    const values = buildSubmissionFormValues([field], () => [url]);
    expect(values.additional_materials).toEqual(field_type === 'file' ? url : [url]);
    expect(findMissingRequiredSubmissionField([field], values)).toBeUndefined();
    const payload = buildSubmissionAnswersPayload([field], values);
    expect(payload).toEqual([{ eventSubmissionFieldId: field.id, answer: values.additional_materials }]);
    const answers = payload.map(({ eventSubmissionFieldId, answer }) => ({
      event_submission_field_id: eventSubmissionFieldId, answer,
    })) as ProjectSubmissionAnswer[];
    // The public and authenticated queries share this hydration function.
    for (const is_private of [false, true]) {
      const restored = applyEffectiveSubmissionToProject(
        { id: 'project-1', event_id: 'event-1', is_private } as Project,
        [field], answers
      );
      expect(restored.additional_materials_url).toBe(url);
      expect(restored.artifacts).toEqual(expect.arrayContaining([expect.objectContaining({ url })]));
      expect(findMissingRequiredSubmissionField([field], restored.submission_values)).toBeUndefined();
    }
  });

  it.each([undefined, '', '  ', [], [''], ['  ']])('still rejects an empty deck: %j', (value) => {
    expect(findMissingRequiredSubmissionField([deck], { additional_materials: value! })).toBe(deck);
  });

  it('normalizes legacy values on reload and custom slide-deck keys on input', () => {
    expect(buildSubmissionValuesFromProject({ additional_materials_url: url }, [deck])).toEqual({ additional_materials: url });
    const custom = { ...deck, key: 'slide_deck' };
    const values = buildSubmissionFormValues([custom], () => url);
    expect(findMissingRequiredSubmissionField([custom], values)).toBeUndefined();
    expect(buildSubmissionAnswersPayload([custom], values)[0].answer).toBe(url);
  });

  it('uses the first non-blank legacy row for a single-file field', () => {
    const values = buildSubmissionFormValues([deck], () => ['', ` ${url} `]);
    expect(values.additional_materials).toBe(url);
  });

  it('preserves multiple decks for multi-file fields', () => {
    const field = { ...deck, field_type: 'multi_file' as const };
    const values = buildSubmissionFormValues([field], () => [url, 'https://example.com/appendix.pdf']);
    expect(buildSubmissionAnswersPayload([field], values)[0].answer).toEqual([url, 'https://example.com/appendix.pdf']);
  });
});

describe('link field rows', () => {
  const project = (fieldType: string, answer: string | string[] | undefined) => ({
    has_submission_field_config: true,
    submission_fields: [{ id: 'f', key: 'project_url', field_type: fieldType }],
    submission_answers: answer === undefined ? [] : [{ event_submission_field_id: 'f', answer }],
  }) as unknown as Partial<Project>;

  it('splits array and string values into a primary link and extras', () => {
    expect(splitUrlRows(['a', '', 'b'])).toEqual({ primary: 'a', extras: ['', 'b'] });
    expect(splitUrlRows([])).toEqual({ primary: '', extras: [] });
    expect(splitUrlRows('a')).toEqual({ primary: 'a', extras: [] });
  });

  it('reads saved rows only from configured multi-value fields', () => {
    expect(getSavedUrlRows(project('multi_url', [' a ', '', 'b']), 'project_url')).toEqual(['a', 'b']);
    expect(getSavedUrlRows(project('multi_url', 'a'), 'project_url')).toEqual(['a']);
    expect(getSavedUrlRows(project('multi_url', undefined), 'project_url')).toEqual([]);
    expect(getSavedUrlRows(project('url', 'a'), 'project_url')).toEqual([]);
    expect(getSavedUrlRows(project('multi_url', ['a']), 'video_url')).toEqual([]);
    expect(getSavedUrlRows({ ...project('multi_url', ['a']), has_submission_field_config: false }, 'project_url')).toEqual([]);
  });
});
