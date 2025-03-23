export interface LogStats {
  totalEntries: number;
  errorCount: number;
  keywordMatches: Record<string, number>;
  ipAddresses: Record<string, number>;
  processingTime: number;
}

export interface JobData {
  jobId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  userId: string;
  timestamp: string;
}
