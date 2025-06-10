import { Button } from "@/components/ui/button";
import { useState } from "react";

interface FileUploadProps {
  handleUpload: (file: File) => Promise<boolean>;
  noteText: string;
}

export function FileUpload({ handleUpload, noteText }: FileUploadProps) {
  const [selectedFile, setFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <div>
      <div className="mb-2">
        <label className="text-xs font-medium text-gray-600 mb-1 block">
          Upload a file:
        </label>

        {!selectedFile ? (
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setFile(file);
              }
            }}
            disabled={isUpdating}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        ) : (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  setIsUpdating(true);
                  const success = await handleUpload(selectedFile);
                  if (success) {
                    setFile(null);
                  }
                  setIsUpdating(false);
                }}
                disabled={isUpdating}
              >
                {isUpdating ? "Uploading..." : "Upload"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">{noteText}</p>
    </div>
  );
}
