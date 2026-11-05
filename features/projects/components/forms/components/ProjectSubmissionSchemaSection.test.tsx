import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProjectSubmissionSchemaSection } from './ProjectSubmissionSchemaSection';
import { buildSubmissionAnswersPayload, buildSubmissionFormValues, findMissingRequiredSubmissionField, type EffectiveSubmissionField, type SubmissionValue } from '@/features/projects/utils/effectiveSubmission';

jest.mock('@/components/projects/ProjectDescription', () => ({ ProjectDescription: () => null }));
jest.mock('@mui/icons-material', () => ({ TextFields: () => null }));
const field: EffectiveSubmissionField = {
  id: 'deck', key: 'additional_materials', label: 'Slide Deck', event_id: 'event',
  field_type: 'file', required: true, sort_order: 0, is_active: true,
};

function Form({ upload }: { upload: () => Promise<string> }) {
  const [urls, setUrls] = useState<SubmissionValue>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const values = buildSubmissionFormValues([field], () => urls);
  return <>
    <ProjectSubmissionSchemaSection fields={[field]} values={values}
      onValueChange={(_, value) => setUrls(value)}
      onFileUpload={async () => { setUrls([await upload()]); }}
      onUploadStateChange={setUploading}
      showDescriptionPreview={false} onToggleDescriptionPreview={() => {}} />
    <button disabled={uploading} onClick={() => setMessage(findMissingRequiredSubmissionField([field], values) ? 'Slide Deck is required' : 'Ready to publish')}>Publish</button>
    <span>{message}</span>
  </>;
}

describe('slide-deck upload UI', () => {
  it('blocks publish while uploading, then displays and accepts the required deck', async () => {
    let finish!: (url: string) => void;
    const upload = jest.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const { container } = render(<Form upload={upload} />);
    fireEvent.click(screen.getByText('Publish'));
    expect(screen.getByText('Slide Deck is required')).toBeInTheDocument();
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['slides'], 'deck.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByRole('status')).toHaveTextContent('Uploading files');
    expect(screen.getByText('Publish')).toBeDisabled();
    await act(async () => { finish('https://example.com/deck.pdf'); });
    expect(screen.getByDisplayValue('https://example.com/deck.pdf')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeEnabled();
    fireEvent.click(screen.getByText('Publish'));
    expect(screen.getByText('Ready to publish')).toBeInTheDocument();
  });

  it('recovers from upload failure without accepting a missing deck', async () => {
    const { container } = render(<Form upload={async () => { throw new Error('Offline'); }} />);
    await act(async () => {
      fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['slides'], 'deck.pdf')] } });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    expect(screen.getByText('Publish')).toBeEnabled();
    fireEvent.click(screen.getByText('Publish'));
    expect(screen.getByText('Slide Deck is required')).toBeInTheDocument();
  });
});

describe('multi_url rows', () => {
  const multiUrlField: EffectiveSubmissionField = {
    id: 'links', key: 'demo_links', label: 'Demo Links', event_id: 'event',
    field_type: 'multi_url', required: true, sort_order: 0, is_active: true,
  };

  // Mirrors the forms: state is derived through buildSubmissionFormValues.
  function LinksForm({ initial, onValues }: {
    initial: SubmissionValue;
    onValues?: (values: Record<string, SubmissionValue>) => void;
  }) {
    const [links, setLinks] = useState<SubmissionValue>(initial);
    const values = buildSubmissionFormValues([multiUrlField], () => links);
    onValues?.(values);
    return <ProjectSubmissionSchemaSection fields={[multiUrlField]} values={values}
      onValueChange={(_, value) => setLinks(value)}
      onFileUpload={() => {}}
      showDescriptionPreview={false} onToggleDescriptionPreview={() => {}} />;
  }

  const rowValues = () =>
    screen.getAllByRole('textbox').map((input) => (input as HTMLInputElement).value);

  it('adds a blank row that can be typed into', () => {
    render(<LinksForm initial={['https://one.example']} />);
    fireEvent.click(screen.getByText('Add another link'));
    expect(rowValues()).toEqual(['https://one.example', '']);
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'https://two.example' } });
    expect(rowValues()).toEqual(['https://one.example', 'https://two.example']);
  });

  it('adds a second row when the field has no links yet', () => {
    render(<LinksForm initial="" />);
    expect(rowValues()).toEqual(['']);
    fireEvent.click(screen.getByText('Add another link'));
    expect(rowValues()).toEqual(['', '']);
  });

  it('keeps a row in place while its text is cleared', () => {
    render(<LinksForm initial={['https://one.example', 'https://two.example']} />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '' } });
    expect(rowValues()).toEqual(['', 'https://two.example']);
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '' } });
    expect(rowValues()).toEqual(['', '']);
  });

  it('removes only the chosen row', () => {
    render(<LinksForm initial={['https://one.example', '', 'https://three.example']} />);
    fireEvent.click(screen.getAllByText('Remove')[1]);
    expect(rowValues()).toEqual(['https://one.example', 'https://three.example']);
  });

  it('strips blank rows from validation and the saved answer', () => {
    let values: Record<string, SubmissionValue> = {};
    render(<LinksForm initial={['  https://one.example ']} onValues={(next) => { values = next; }} />);
    fireEvent.click(screen.getByText('Add another link'));
    expect(findMissingRequiredSubmissionField([multiUrlField], values)).toBeUndefined();
    expect(buildSubmissionAnswersPayload([multiUrlField], values)).toEqual([
      { eventSubmissionFieldId: 'links', answer: ['https://one.example'] },
    ]);
    expect(findMissingRequiredSubmissionField([multiUrlField], { demo_links: ['', ' '] })).toBe(multiUrlField);
  });
});
