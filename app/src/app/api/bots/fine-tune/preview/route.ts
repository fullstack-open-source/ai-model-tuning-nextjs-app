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
 * Preview training data (returns JSON structure)
 * POST /api/fine-tune/preview
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
      const entries: any[] = []
      let total = 0

      // Read JSONL file
      const fileStream = createReadStream(tempFilePath)
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      })

      for await (const line of rl) {
        if (!line.trim()) continue

        total++
        
        try {
          const entry = JSON.parse(line)
          entries.push(entry)

          // Limit to first 10 entries for preview
          if (entries.length >= 10) {
            break
          }
        } catch (parseError: any) {
          // Skip invalid JSON lines but continue counting
          logger.warning('Skipping invalid JSON line', { extraData: { lineNumber: total, error: parseError.message } })
        }
      }

      logger.info('Training data preview generated', { extraData: { total, previewCount: entries.length } })

      return SUCCESS.json('Preview generated successfully', {
        entries,
        total,
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
    logger.error('Error previewing training data', { extraData: { error: error.message } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

