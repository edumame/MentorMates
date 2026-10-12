import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProjectSubmissionSchemaSection } from './ProjectSubmissionSchemaSection';
import { buildSubmissionFormValues, findMissingRequiredSubmissionField, type EffectiveSubmissionField, type SubmissionValue } from '@/features/projects/utils/effectiveSubmission';

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
