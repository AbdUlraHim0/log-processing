// packages/web/src/components/dashboard/upload-section.tsx
"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { useWebSocket } from "@/context/websocket-context";
import { uploadLogFile } from "@/utils/supabase/client";

interface UploadSectionProps {
  user: User;
}

export const UploadSection = ({ user }: UploadSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<{
    success?: boolean;
    message?: string;
    jobId?: string;
  } | null>(null);

  const { jobUpdates } = useWebSocket();

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
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelection(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      handleFileSelection(selectedFile);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    const allowedTypes = ["text/plain", "application/octet-stream"];
    const isLogFile =
      selectedFile.name.endsWith(".log") || selectedFile.name.endsWith(".txt");

    if (!allowedTypes.includes(selectedFile.type) && !isLogFile) {
      setUploadStatus({
        success: false,
        message: "Invalid file type. Please upload a text or log file.",
      });
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (selectedFile.size > maxSize) {
      setUploadStatus({
        success: false,
        message: `File is too large. Maximum size is 100MB.`,
      });
      return;
    }

    setUploadStatus(null);
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus({
        success: false,
        message: "Please select a file to upload.",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    try {
      setUploadProgress(10);
      const uploadResult = await uploadLogFile(file, user.id);

      if (!uploadResult.success) {
        throw new Error(
          uploadResult.error || "Failed to upload file to storage."
        );
      }

      if (!uploadResult.success) {
        throw new Error(
          uploadResult.error || "Failed to upload file to storage."
        );
      }

      if (!uploadResult.filePath) {
        throw new Error("No file path returned from storage upload.");
      }

      setUploadProgress(50);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("filePath", uploadResult.filePath);
      formData.append("fileName", file.name);

      const response = await fetch("/api/upload-logs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to queue file for processing."
        );
      }

      const data = await response.json();
      setUploadProgress(100);

      setUploadStatus({
        success: true,
        message:
          data.message ||
          "File uploaded successfully and queued for processing!",
        jobId: data.jobId,
      });

      setFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus({
        success: false,
        message:
          error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadStatus(null);
    setUploadProgress(0);
  };

  const getJobProgress = () => {
    if (!uploadStatus?.jobId) return null;

    const jobUpdate = jobUpdates[uploadStatus.jobId];
    return jobUpdate ? jobUpdate.progress : null;
  };

  const isJobInProgress =
    uploadStatus?.jobId &&
    jobUpdates[uploadStatus.jobId]?.status === "processing";

  // Get the current job status
  const jobStatus = uploadStatus?.jobId
    ? jobUpdates[uploadStatus.jobId]?.status
    : null;

  return (
    <div className="bg-background rounded-lg shadow border border-secondary-200 dark:border-secondary-800 p-6 mb-6">
      <h3 className="font-medium mb-2">File Upload</h3>
      <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
        Upload log files to be processed by the system. Supported formats: .log,
        .txt (Max 100MB).
      </p>

      {/* Status message */}
      {uploadStatus && (
        <div
          className={`p-4 mb-4 rounded-md ${
            uploadStatus.success
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {uploadStatus.success ? (
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{uploadStatus.message}</p>
              {uploadStatus.jobId && (
                <div className="mt-2 text-sm">
                  <div>
                    Job ID:{" "}
                    <span className="font-mono">{uploadStatus.jobId}</span>
                  </div>
                  {jobStatus && (
                    <div className="mt-1">
                      Status:{" "}
                      <span
                        className={`font-medium ${
                          jobStatus === "completed"
                            ? "text-green-600 dark:text-green-400"
                            : jobStatus === "failed"
                            ? "text-red-600 dark:text-red-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-6 cursor-pointer text-center transition-colors ${
          isDragging
            ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
            : "border-secondary-300 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-900"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".log,.txt,text/plain"
          onChange={handleFileChange}
          className="hidden"
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

          <p className="text-sm font-medium text-secondary-600 dark:text-secondary-400">
            {file
              ? `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(
                  2
                )} MB)`
              : "Drag and drop a log file here, or click to select"}
          </p>
          <p className="text-xs text-secondary-500 dark:text-secondary-500">
            Supports .log, .txt files (Max 100MB)
          </p>
        </div>
      </div>

      {file && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between">
          <div className="text-sm mb-2 sm:mb-0">
            <span className="font-medium">Selected file:</span>{" "}
            <span className="text-secondary-600 dark:text-secondary-400">
              {file.name}
            </span>{" "}
            <span className="text-secondary-500 dark:text-secondary-500">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleReset}
              disabled={isUploading}
              className="px-3 py-1 border border-secondary-300 dark:border-secondary-700 rounded shadow-sm text-secondary-700 dark:text-secondary-300 text-sm hover:bg-secondary-50 dark:hover:bg-secondary-900 focus:outline-none"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || !file}
              className={`px-3 py-1 rounded shadow-sm text-white text-sm focus:outline-none ${
                isUploading
                  ? "bg-secondary-400 cursor-not-allowed"
                  : "bg-primary-500 hover:bg-primary-600"
              }`}
            >
              {isUploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
        </div>
      )}

      {(isUploading || isJobInProgress) && (
        <div className="mt-4">
          <div className="flex justify-between mb-1 text-sm">
            <span className="text-secondary-600 dark:text-secondary-400">
              {isUploading ? "Uploading..." : "Processing..."}
            </span>
            <span className="text-secondary-600 dark:text-secondary-400">
              {isUploading
                ? `${uploadProgress}%`
                : getJobProgress() !== null
                ? `${getJobProgress()}%`
                : "Waiting..."}
            </span>
          </div>
          <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-primary-500"
              style={{
                width: `${
                  isUploading ? uploadProgress : getJobProgress() || 0
                }%`,
              }}
            ></div>
          </div>
          {isJobInProgress && (
            <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">
              Your file is being processed. You can view progress in the queue
              section below.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
