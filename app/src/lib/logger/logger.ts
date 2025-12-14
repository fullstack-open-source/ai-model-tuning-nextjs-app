import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

import type { LogContext, PerformanceEntry, SecurityEvent } from './../../types/logger';
import { loggingConfig } from '@lib/config/env';


export class ProfessionalLogger {
  private static instance: ProfessionalLogger;
  private logger: winston.Logger;
  private performanceData: PerformanceEntry[] = [];
  private securityEvents: SecurityEvent[] = [];
  private logDir: string;

  private constructor() {
    this.logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const consoleTransport = new winston.transports.Console({
      level: loggingConfig.level,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let context = '';
          if (meta.module) context += `[${meta.module}] `;
          if (meta.label) context += `[${meta.label}] `;
          if (meta.userId) context += `[User:${meta.userId}] `;
          if (meta.requestId && typeof meta.requestId === 'string') context += `[Req:${meta.requestId.slice(0, 8)}] `;
          return `${timestamp} [${level}] ${context}${message}`;
        })
      ),
    });

    const fileTransport = new DailyRotateFile({
      filename: path.join(this.logDir, 'server-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '10d',
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let context = '';
          if (meta.module) context += `[Module:${meta.module}] `;
          if (meta.label) context += `[Label:${meta.label}] `;
          if (meta.userId) context += `[User:${meta.userId}] `;
          if (meta.requestId && typeof meta.requestId === 'string') context += `[Req:${meta.requestId.slice(0, 8)}] `;
          return `${timestamp} [${level}] ${context}${message}`;
        })
      ),
    });

    this.logger = winston.createLogger({
      level: 'debug',
      transports: [consoleTransport, fileTransport],
      exitOnError: false,
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(fileTransport, consoleTransport);
    this.logger.rejections.handle(fileTransport, consoleTransport);
  }

  public static getInstance(): ProfessionalLogger {
    if (!ProfessionalLogger.instance) {
      ProfessionalLogger.instance = new ProfessionalLogger();
    }
    return ProfessionalLogger.instance;
  }

  private log(level: string, message: string, context: LogContext = {}) {
    this.logger.log(level, message, context);
  }

  public info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  public debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  public warning(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  public error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }

  public critical(message: string, context?: LogContext) {
    this.log('crit', message, context);
  }

  public success(message: string, context?: LogContext) {
    this.log('info', `✅ SUCCESS: ${message}`, context);
  }

  public security(message: string, context?: LogContext) {
    this.log('warn', `🔒 SECURITY: ${message}`, context);
    this.securityEvents.push({ timestamp: new Date().toISOString(), message, context });
  }

  public performance(operation: string, duration: number, context?: LogContext) {
    this.log('info', `⚡ PERFORMANCE: ${operation} took ${duration.toFixed(3)}s`, context);
    this.performanceData.push({ operation, duration });
  }

  public request(method: string, path: string, statusCode: number, duration: number, context?: LogContext) {
    this.log('info', `🌐 REQUEST: ${method} ${path} -> ${statusCode} (${duration.toFixed(3)}s)`, context);
  }

  public database(operation: string, table: string, duration: number, context?: LogContext) {
    this.log('debug', `🗄️ DATABASE: ${operation} on ${table} (${duration.toFixed(3)}s)`, context);
  }

  public apiCall(service: string, endpoint: string, statusCode: number, duration: number, context?: LogContext) {
    this.log('info', `🔗 API: ${service} ${endpoint} -> ${statusCode} (${duration.toFixed(3)}s)`, context);
  }

  public getPerformanceSummary() {
    const total = this.performanceData.length;
    const avg = total ? this.performanceData.reduce((sum, x) => sum + x.duration, 0) / total : 0;
    const slowest = total ? this.performanceData.reduce((a, b) => (a.duration > b.duration ? a : b)) : null;
    return { total, avg, slowest, operations: this.performanceData };
  }

  public getSecuritySummary() {
    const total = this.securityEvents.length;
    const recent = total ? this.securityEvents.slice(-10) : [];
    return { total, recent, all: this.securityEvents };
  }

  public cleanupOldLogs(days: number = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    fs.readdirSync(this.logDir).forEach(file => {
      const filePath = path.join(this.logDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtime.getTime() < cutoff) fs.unlinkSync(filePath);
    });
  }
}

// Singleton instance
export const logger = ProfessionalLogger.getInstance();
