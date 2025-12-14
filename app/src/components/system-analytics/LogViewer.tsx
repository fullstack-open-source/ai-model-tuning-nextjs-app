"use client"

import { useState, useEffect } from "react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { Search, Trash2, Filter, FileX } from "lucide-react"
import { systemAnalyticsService, type LogFileContent, type LogEntry } from "@services/system-analytics.service"
import { useToast } from "@hooks/useToast"

interface LogViewerProps {
  filename: string
  onClose: () => void
  onFileDeleted?: () => void
}

export function LogViewer({ filename, onClose, onFileDeleted }: LogViewerProps) {
  const { showError } = useToast()
  const [logContent, setLogContent] = useState<LogFileContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [filters, setFilters] = useState({
    level: "All",
    module: "",
    search: "",
  })
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)

  const loadLogFile = async () => {
    setLoading(true)
    try {
      const content = await systemAnalyticsService.readLogFile(filename, {
        level: filters.level !== "All" ? filters.level : undefined,
        module: filters.module || undefined,
        search: filters.search || undefined,
        limit,
        offset,
      })
      setLogContent(content)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load log file"
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogFile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, filters.level, filters.module, filters.search, limit, offset])

  const handleClear = async () => {
    try {
      await systemAnalyticsService.clearLogFile(filename)
      loadLogFile()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to clear log file"
      showError(errorMessage)
      throw error // Re-throw to let ConfirmDialog handle the error state
    }
  }

  const handleDelete = async () => {
    try {
      await systemAnalyticsService.deleteLogFile(filename)
      if (onFileDeleted) {
        onFileDeleted()
      }
      onClose()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete log file"
      showError(errorMessage)
      throw error // Re-throw to let ConfirmDialog handle the error state
    }
  }

  const handleRowClick = (entry: LogEntry) => {
    setSelectedEntry(entry)
  }

  const getLevelColor = (level: string) => {
    const levelLower = level.toLowerCase()
    if (levelLower === "error") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    if (levelLower === "warn" || levelLower === "warning") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    if (levelLower === "info") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    if (levelLower === "debug") return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }

  const availableLevels = logContent?.statistics?.byLevel
    ? ["All", ...Object.keys(logContent.statistics.byLevel)]
    : ["All", "ERROR", "WARN", "INFO", "DEBUG"]

  return (
    <>
      <SidePanel
        open={true}
        onClose={onClose}
        title={filename}
        description="Log file viewer"
        width="lg"
        side="right"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowClearDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <FileX className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filters.level}
                onChange={(e) => {
                  setFilters({ ...filters, level: e.target.value })
                  setOffset(0)
                }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {availableLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <Input
              placeholder="Filter by module..."
              value={filters.module}
              onChange={(e) => {
                setFilters({ ...filters, module: e.target.value })
                setOffset(0)
              }}
              className="w-full sm:w-48"
            />
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search in logs..."
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value })
                  setOffset(0)
                }}
                className="flex-1 min-w-0"
              />
            </div>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setOffset(0)
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </div>

          {/* Statistics */}
          {logContent?.statistics && (
            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm flex-shrink-0">
              <span className="text-muted-foreground">
                Total: <strong>{logContent.statistics.total}</strong>
              </span>
              {Object.entries(logContent.statistics.byLevel).map(([level, count]) => (
                <span key={level} className="text-muted-foreground">
                  {level}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Log Entries */}
          <div className="border rounded-md overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : logContent?.entries && logContent.entries.length > 0 ? (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-xs sm:text-sm min-w-[800px]">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <tr>
                      <th className="text-left p-2 font-medium">Line</th>
                      <th className="text-left p-2 font-medium">Time</th>
                      <th className="text-left p-2 font-medium">Level</th>
                      <th className="text-left p-2 font-medium">Message</th>
                      <th className="text-left p-2 font-medium">Logger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logContent.entries.map((entry) => (
                      <tr 
                        key={entry.line} 
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(entry)}
                      >
                        <td className="p-2 font-mono text-xs whitespace-nowrap">{entry.line}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{entry.timestamp}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs ${getLevelColor(entry.level)}`}>
                            {entry.level}
                          </span>
                        </td>
                        <td className="p-2 break-words max-w-md">{entry.message}</td>
                        <td className="p-2 text-muted-foreground break-words max-w-xs">{entry.module || "unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No log entries found
              </div>
            )}
          </div>

          {/* Pagination */}
          {logContent?.pagination && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t">
              <div className="text-xs sm:text-sm text-muted-foreground">
                Showing {offset + 1} to {Math.min(offset + limit, logContent.pagination.total)} of {logContent.pagination.total}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="flex-1 sm:flex-initial"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={!logContent.pagination.hasMore}
                  className="flex-1 sm:flex-initial"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </SidePanel>

      {/* Log Entry Details Side Panel */}
      <SidePanel
        open={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
        title="Log Entry Details"
        width="md"
        side="right"
      >
        {selectedEntry && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Line Number</span>
                <span className="text-sm font-mono font-semibold">{selectedEntry.line}</span>
              </div>
              <div className="h-px bg-border" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Timestamp</span>
                <span className="text-sm">{selectedEntry.timestamp}</span>
              </div>
              <div className="h-px bg-border" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Level</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(selectedEntry.level)}`}>
                  {selectedEntry.level}
                </span>
              </div>
              <div className="h-px bg-border" />
            </div>

            {selectedEntry.module && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Module/Logger</span>
                  <span className="text-sm font-semibold">{selectedEntry.module}</span>
                </div>
                <div className="h-px bg-border" />
              </div>
            )}

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Message</span>
              <div className="p-3 bg-muted rounded-md border">
                <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                  {selectedEntry.message}
                </pre>
              </div>
            </div>

            {selectedEntry.filename && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Source File</span>
                  <span className="text-sm font-mono">{selectedEntry.filename}</span>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedEntry(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClear}
        title="Clear Log File"
        description={`Are you sure you want to clear "${filename}"? This will remove all log entries but keep the file.`}
        confirmText="Yes, Clear"
        cancelText="Cancel"
        variant="default"
        successMessage="Log file cleared successfully!"
        errorMessage="Failed to clear log file. Please try again."
        autoCloseOnSuccess={true}
        autoCloseDelay={1500}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Log File"
        description={`Are you sure you want to DELETE "${filename}"? This action cannot be undone and the file will be permanently removed.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        successMessage="Log file deleted successfully!"
        errorMessage="Failed to delete log file. Please try again."
        autoCloseOnSuccess={true}
        autoCloseDelay={1500}
      />
    </>
  )
}

