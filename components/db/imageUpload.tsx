import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ImageUploadProps {
    handleUpload: (file: File) => Promise<boolean>;
    noteText: string;
}

export function ImageUpload({ handleUpload, noteText }: ImageUploadProps) {
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
  return (
    <div>
      <div className="mb-2">
        <label className="text-xs font-medium text-gray-600 mb-1 block">
          Upload an image file:
        </label>

        {!selectedImageFile ? (
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedImageFile(file);
              }
            }}
            disabled={isUpdating}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        ) : (
          <div className="space-y-3">
            {/* File Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {selectedImageFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const success = await handleUpload(selectedImageFile);
                    if (success) {
                      setSelectedImageFile(null);
                    }
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Uploading..." : "Upload"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsUpdating(true);
                    setSelectedImageFile(null);
                    setIsUpdating(false);
                  }}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Image Preview */}
            <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(selectedImageFile)}
                alt="Cover image preview"
                className="w-full h-full object-cover"
                onLoad={(e) => {
                  // Clean up the object URL to prevent memory leaks
                  URL.revokeObjectURL((e.target as HTMLImageElement).src);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {noteText}
      </p>
    </div>
  );
}
