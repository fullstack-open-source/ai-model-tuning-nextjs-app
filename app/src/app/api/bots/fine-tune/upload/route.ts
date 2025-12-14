import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * Upload training file to OpenAI
 * POST /api/fine-tune/upload
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
      // Get OpenAI API key from environment
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        return ERROR.json('OPENAI_API_KEY_NOT_CONFIGURED', {})
      }

      // Upload file directly to OpenAI API
      const formData = new FormData()
      const fileBlob = new Blob([buffer], { type: 'application/jsonl' })
      formData.append('file', fileBlob, file.name)
      formData.append('purpose', 'fine-tune')

      const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      })

      // Check response status code (OpenAI returns 200 for success)
      if (uploadResponse.status !== 200) {
        let errorData: {
          error?: {
            message?: string
            code?: string
            type?: string
            param?: string
            [key: string]: unknown
          }
        }
        try {
          errorData = await uploadResponse.json() as typeof errorData
        } catch {
          errorData = {
            error: {
              message: `HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`,
              code: String(uploadResponse.status),
            },
          }
        }
        
        const errorDetails = errorData.error || {}
        
        logger.error('OpenAI upload failed', {
          extraData: {
            error: errorDetails,
            statusCode: uploadResponse.status,
            fileName: file.name,
            fullResponse: errorData,
          },
        })
        
        return ERROR.json('UPLOAD_FAILED', {
          error: errorDetails.message || `Upload failed with status ${uploadResponse.status}`,
          code: errorDetails.code,
          type: errorDetails.type,
          param: errorDetails.param,
        })
      }

      const uploadResult = await uploadResponse.json()

      // Validate OpenAI response structure
      // OpenAI returns: { id: string, object: 'file', bytes: number, ... }
      if (!uploadResult || !uploadResult.id) {
        logger.error('Invalid OpenAI upload response', { extraData: { response: uploadResult } })
        return ERROR.json('UPLOAD_FAILED', { error: 'Invalid response from OpenAI API - no file ID returned' })
      }

      const fileId = uploadResult.id

      logger.info('Training file uploaded successfully', {
        extraData: {
          file_id: fileId,
          file_name: file.name,
        },
      })

      return SUCCESS.json('File uploaded successfully', { file_id: fileId })
    } finally {
      // Clean up temp file
      try {
        await unlink(tempFilePath)
      } catch (cleanupError) {
        logger.error('Error cleaning up temp file', { extraData: { error: cleanupError } })
      }
    }
  } catch (error: any) {
    logger.error('Error uploading training file', { extraData: { error: error.message } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

