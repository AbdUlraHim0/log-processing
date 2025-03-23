"use client";

import React, { useState, useRef } from "react";
import { uploadLogFile } from "@/utils/supabase/client";

interface FileUploadProps {
  onUploadComplete: (data: any) => void;
  onUploadError: (error: string) => void;
  userId: string;
  maxFileSize?: number; // in bytes, default 100MB
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onUploadError,
  userId,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (
      !file.type.includes("text") &&
      !file.name.endsWith(".log") &&
      !file.name.endsWith(".txt")
    ) {
      onUploadError("Only text files, .log, and .txt files are supported");
      return;
    }

    if (file.size > maxFileSize) {
      onUploadError(
        `File size exceeds the maximum limit of ${
          maxFileSize / (1024 * 1024)
        }MB`
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadResult = await uploadLogFile(file, userId);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      if (!uploadResult.filePath || !uploadResult.fileName) {
        throw new Error("File path or file name is undefined");
      }

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("filePath", uploadResult.filePath);
      formData.append("fileName", uploadResult.fileName);

      const response = await fetch("/api/upload-logs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Processing failed");
      }

      const result = await response.json();
      setIsUploading(false);
      setUploadProgress(100);

      onUploadComplete(result);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setIsUploading(false);
      onUploadError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 cursor-pointer text-center transition-colors ${
          isDragging
            ? "border-primary-600 bg-primary-50 dark:bg-primary-950"
            : "border-secondary-300 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-900"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
          accept=".log,.txt,text/*"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <svg
            className="w-10 h-10 text-secondary-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-sm text-secondary-600 dark:text-secondary-400">
            {isUploading
              ? `Uploading... ${uploadProgress}%`
              : "Drag and drop a log file here, or click to select"}
          </p>
          <p className="text-xs text-secondary-500 dark:text-secondary-500">
            Supports .log, .txt files (Max {maxFileSize / (1024 * 1024)}MB)
          </p>
        </div>

        {isUploading && (
          <div className="mt-4 w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};
