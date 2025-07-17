import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onFilesSelected,
  accept,
  multiple = false,
  className,
  disabled = false
}: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    multiple,
    disabled
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer transition-colors",
        "hover:border-muted-foreground/50 hover:bg-muted/50",
        isDragActive && "border-primary bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
      {isDragActive ? (
        <p className="text-sm text-muted-foreground">Drop the files here...</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Drag & drop files here, or click to select
          </p>
          {accept && (
            <p className="text-xs text-muted-foreground/75">
              Accepted formats: {accept}
            </p>
          )}
        </div>
      )}
    </div>
  );
}