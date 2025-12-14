// Interface for a single error
export interface ErrorMapItem {
  code: number;
  message: string;
  reason?: string;
  http_status?: number;
}

// Optional: type for the full error map
export type ErrorMap = Record<string, ErrorMapItem>;
