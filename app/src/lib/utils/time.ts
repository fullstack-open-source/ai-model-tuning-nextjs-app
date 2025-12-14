/**
 * Time utility functions
 */

import { formatDate } from './date-format'

/**
 * Format a date as relative time (e.g., "1m ago", "2h ago", "3 days ago")
 * For dates older than 30 days, shows formatted date: "21 Jan, 2025"
 */
export function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return "Never"
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (diffInSeconds < 0) return "Just now"
  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  // For dates older than 30 days, show formatted date
  return formatDate(then)
}


