import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

/**
 * Validate training data file
 * POST /api/fine-tune/validate
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return ERROR.json('FILE_REQUIRED', {})
    }

    // Check file extension
    if (!file.name.endsWith('.jsonl')) {
      return ERROR.json('INVALID_FILE_TYPE', { expected: '.jsonl' })
    }

    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'tmp', 'fine-tune')
    await mkdir(tempDir, { recursive: true })

    // Save file temporarily
    const tempFileName = `${uuidv4()}.jsonl`
    const tempFilePath = join(tempDir, tempFileName)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(tempFilePath, buffer)

    try {
      const errors: string[] = []
      const warnings: string[] = []
      const sampleEntries: any[] = []
      let entryCount = 0

      // Read and validate JSONL file
      const fileStream = createReadStream(tempFilePath)
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      })

      for await (const line of rl) {
        if (!line.trim()) continue

        entryCount++
        
        try {
          const entry = JSON.parse(line)

          // Validate structure
          if (!entry.messages || !Array.isArray(entry.messages)) {
            errors.push(`Line ${entryCount}: Missing or invalid 'messages' array`)
            continue
          }

          if (entry.messages.length === 0) {
            errors.push(`Line ${entryCount}: 'messages' array is empty`)
            continue
          }

          // Validate each message
          for (let i = 0; i < entry.messages.length; i++) {
            const message = entry.messages[i]
            
            if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
              errors.push(`Line ${entryCount}, message ${i + 1}: Invalid or missing 'role' (must be 'user', 'assistant', or 'system')`)
            }

            if (!message.content || typeof message.content !== 'string') {
              errors.push(`Line ${entryCount}, message ${i + 1}: Missing or invalid 'content'`)
            }

            if (message.content && message.content.length > 100000) {
              warnings.push(`Line ${entryCount}, message ${i + 1}: Content is very long (${message.content.length} characters)`)
            }
          }

          // Check for proper conversation flow
          const firstMessage = entry.messages[0]
          if (firstMessage.role !== 'system' && firstMessage.role !== 'user') {
            warnings.push(`Line ${entryCount}: First message should typically be 'system' or 'user', got '${firstMessage.role}'`)
          }

          // Store sample entries (first 3)
          if (sampleEntries.length < 3) {
            sampleEntries.push(entry)
          }
        } catch (parseError: any) {
          errors.push(`Line ${entryCount}: Invalid JSON - ${parseError.message}`)
        }
      }

      const valid = errors.length === 0

      logger.info('Training data validation completed', {
        extraData: {
          valid,
          entryCount,
          errorCount: errors.length,
          warningCount: warnings.length,
        },
      })

      return SUCCESS.json('Validation completed', {
        valid,
        errors,
        warnings,
        entry_count: entryCount,
        sample_entries: sampleEntries,
      })
    } finally {
      // Clean up temp file
      try {
        await unlink(tempFilePath)
      } catch (cleanupError) {
        logger.error('Error cleaning up temp file', { extraData: { error: cleanupError } })
      }
    }
  } catch (error: any) {
    logger.error('Error validating training data', { extraData: { error: error.message } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

