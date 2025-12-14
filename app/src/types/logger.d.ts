
// @types/logger.d.ts

export interface LogContext {
  module?: string;
  label?: string;
  userId?: string;
  requestId?: string;
  extraData?: Record<string, any>;
}

export interface PerformanceEntry {
  operation: string;
  duration: number;
}

export interface SecurityEvent {
  timestamp: string;
  message: string;
  context?: LogContext;
}