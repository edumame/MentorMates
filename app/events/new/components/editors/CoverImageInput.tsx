"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import type { WizardEventData } from "@/lib/types/wizard";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { validateCoverImageFile } from "@/lib/utils/file";

interface CoverImageInputProps {
  event: WizardEventData;
  update: (fields: Partial<WizardEventData>) => void;
}

/**
 * Cover image picker for the event wizard. Organizers can either upload a
 * file (stored as `cover_image_file` and uploaded when the event is created)
 * or paste an image URL. Choosing one clears the other so the preview always
 * matches what will be saved.
 */
export function CoverImageInput({ event, update }: CoverImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const filePreviewUrl = useObjectUrl(event.cover_image_file);
  const previewUrl = filePreviewUrl ?? (event.cover_image_url || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    const validationError = validateCoverImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    update({ cover_image_file: file, cover_image_url: "" });
  };

  const handleRemove = () => {
    setError(null);
    update({ cover_image_file: undefined, cover_image_url: "" });
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">Cover Image</label>

      {previewUrl && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: and arbitrary external URLs */}
          <img
            src={previewUrl}
            alt="Cover image preview"
            className="h-40 w-full rounded-xl border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove cover image"
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-gray-600 shadow hover:text-gray-900"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Upload className="size-4" />
          {event.cover_image_file ? "Replace image" : "Upload image"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="cover-image-file-input"
        />
        <div className="relative flex-1">
          <ImageIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
          <input
            type="url"
            value={event.cover_image_url}
            onChange={(e) => {
              setError(null);
              update({
                cover_image_url: e.target.value,
                cover_image_file: undefined,
              });
            }}
            placeholder={
              event.cover_image_file
                ? event.cover_image_file.name
                : "or paste an image URL (https://...)"
            }
            aria-label="Cover image URL"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        <p className="text-xs text-gray-400">PNG, JPG, GIF or WebP, up to 5MB.</p>
      )}
    </div>
  );
}
