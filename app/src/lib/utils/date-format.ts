/**
 * Date Formatting Utilities
 * Provides consistent, readable date formatting across the application
 */

/**
 * Format date to readable format: "21 Jan, 2025"
 */
export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "N/A"
  
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  if (isNaN(dateObj.getTime())) return "Invalid Date"
  
  const day = dateObj.getDate()
  const month = dateObj.toLocaleString('en-US', { month: 'short' })
  const year = dateObj.getFullYear()
  
  return `${day} ${month}, ${year}`
}

/**
 * Format date with time: "21 Jan, 2025 at 10:30 AM"
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "N/A"
  
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  if (isNaN(dateObj.getTime())) return "Invalid Date"
  
  const day = dateObj.getDate()
  const month = dateObj.toLocaleString('en-US', { month: 'short' })
  const year = dateObj.getFullYear()
  const time = dateObj.toLocaleString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
  
  return `${day} ${month}, ${year} at ${time}`
}

/**
 * Format time only: "10:30 AM"
 */
export function formatTime(date: Date | string | number | null | undefined): string {
  if (!date) return "N/A"
  
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  if (isNaN(dateObj.getTime())) return "Invalid Date"
  
  return dateObj.toLocaleString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

/**
 * Format relative time: "2 hours ago", "3 days ago", etc.
 */
export function formatRelativeTime(date: Date | string | number | null | undefined): string {
  if (!date) return "N/A"
  
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date
  
  if (isNaN(dateObj.getTime())) return "Invalid Date"
  
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)
  
  if (diffSecs < 60) return "just now"
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
}

