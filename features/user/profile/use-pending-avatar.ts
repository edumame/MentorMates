import { useCallback, useState, type ChangeEvent } from "react";

/**
 * The avatar image a user picked but has not saved yet (NEW-002).
 *
 * The profile page has two file inputs (header camera and edit-profile modal).
 * Save used to re-read `document.querySelector('input[type="file"]')`, which
 * is always the header input, so a file picked in the modal was never
 * uploaded. Keeping the File from the change event removes that lookup.
 */
export function usePendingAvatar(validate: (file: File) => string | null) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const select = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      // Reset so picking the same file again still fires onChange.
      event.target.value = "";
      if (!picked) return;
      if (validate(picked) !== null) return;
      setFile(picked);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(picked);
    },
    [validate]
  );

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
  }, []);

  return { file, preview, select, clear };
}
