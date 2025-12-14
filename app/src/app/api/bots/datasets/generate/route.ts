import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { createHash } from 'crypto'
import { emitDatasetCreated, emitDatasetProgress, emitDatasetUpdated } from '@lib/websocket/emitter'

/**
 * List all dataset generation jobs (datasets with status pending/processing/completed/failed)
 * GET /api/datasets/generate?limit=50&offset=0
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Filter datasets that are generation jobs (content is null, status indicates job state)
    const where = {
      // Generation jobs don't have content yet (or failed)
      content: null,
    }

    const [jobs, total] = await Promise.all([
      prisma.dataset.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
        include: {
          createdBy: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      prisma.dataset.count({ where }),
    ])

    return SUCCESS.json('Generation jobs retrieved successfully', {
      jobs,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching generation jobs', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Create dataset generation job (queue-based)
 * POST /api/datasets/generate
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const body = await req.json()
    const { title, description, num_examples = 100, dataset_type = 'all' } = body

    if (!title || !description) {
      return ERROR.json('MISSING_REQUIRED_FIELDS', { fields: ['title', 'description'] })
    }

    // Validate num_examples
    const numExamples = parseInt(String(num_examples), 10)
    if (isNaN(numExamples) || numExamples < 1 || numExamples > 100000) {
      return ERROR.json('INVALID_NUM_EXAMPLES', { 
        message: 'Number of examples must be between 1 and 100,000' 
      })
    }

    // Calculate batches (5 examples per batch for optimization)
    const batchSize = 5
    const totalBatches = Math.ceil(numExamples / batchSize)

    // Create dataset with generation status (will be updated when generation completes)
    const job = await prisma.dataset.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        dataset_type: dataset_type as string,
        num_examples: null, // Will be set when generation completes
        content: null, // Will be set when generation completes
        status: 'pending',
        progress: 0,
        current_batch: 0,
        total_batches: totalBatches,
        generated_count: 0,
        created_by: user?.uid || user?.user_id || null,
        metadata: {
          batch_size: batchSize,
          target_examples: numExamples,
          created_at: new Date().toISOString(),
          is_generation_job: true,
        },
      },
    })

    // Emit WebSocket event
    try {
      emitDatasetCreated(job)
    } catch (error) {
      logger.warning('Failed to emit dataset created WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    // Notify admins about generation started
    try {
      const { notifyDatasetGenerationStarted } = await import('@lib/notifications/bot-notifications')
      await notifyDatasetGenerationStarted({
        job_id: job.dataset_id,
        title,
      })
    } catch (notifError) {
      logger.warning('Failed to send notification for dataset generation started', {
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
      })
    }

    // Start processing in background (don't await)
    processGenerationJob(job.dataset_id).catch((error) => {
      logger.error('Error processing generation job', {
        extraData: { dataset_id: job.dataset_id, error: error.message },
      })
    })

    logger.info('Dataset generation job created', {
      extraData: {
        dataset_id: job.dataset_id,
        title,
        num_examples: numExamples,
      },
    })

    return SUCCESS.json('Dataset generation job created successfully', {
      job_id: job.dataset_id, // Use dataset_id as job_id
      dataset_id: job.dataset_id,
      status: job.status,
      progress: job.progress,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error creating generation job', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Create a hash/fingerprint for an example to check uniqueness
 */
function createExampleHash(example: {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}): string {
  // Normalize the example by sorting messages and creating a consistent string
  const normalized = {
    messages: example.messages
      .map((msg) => ({
        role: msg.role,
        content: msg.content.trim().toLowerCase(),
      }))
      .sort((a, b) => {
        // Sort by role first, then content
        if (a.role !== b.role) return a.role.localeCompare(b.role)
        return a.content.localeCompare(b.content)
      }),
  }
  const jsonString = JSON.stringify(normalized)
  return createHash('sha256').update(jsonString).digest('hex')
}

/**
 * Get all existing example hashes from all datasets in the database
 */
async function getAllExistingExampleHashes(): Promise<Set<string>> {
  const existingHashes = new Set<string>()
  
  try {
    // Get all datasets with content (completed datasets)
    const datasets = await prisma.dataset.findMany({
      where: {
        content: { not: null },
      },
      select: {
        content: true,
      },
    })

    // Extract and hash all examples from existing datasets
    for (const dataset of datasets) {
      if (!dataset.content) continue
      
      try {
        const lines = dataset.content.split('\n').filter((line: string) => line.trim())
        for (const line of lines) {
          try {
            const example = JSON.parse(line) as {
              messages?: Array<{ role?: string; content?: string }>
            }
            if (example && example.messages && Array.isArray(example.messages)) {
              const normalizedExample = {
                messages: example.messages.map((msg) => ({
                  role: (msg.role || 'user') as 'user' | 'assistant' | 'system',
                  content: (msg.content || '').trim(),
                })),
              }
              const hash = createExampleHash(normalizedExample)
              existingHashes.add(hash)
            }
          } catch {
            // Skip invalid JSON lines
            continue
          }
        }
      } catch {
        // Skip datasets with invalid content
        continue
      }
    }
  } catch (error) {
    logger.warning('Error fetching existing example hashes', {
      extraData: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
  }

  return existingHashes
}

/**
 * Process generation job in batches
 */
async function processGenerationJob(datasetId: string) {
  try {
    // Update status to processing
    const processingDataset = await prisma.dataset.update({
      where: { dataset_id: datasetId },
      data: { status: 'processing' },
    })

    // Emit WebSocket progress event
    try {
      emitDatasetProgress(processingDataset)
    } catch (error) {
      logger.warning('Failed to emit dataset progress WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    const job = await prisma.dataset.findUnique({
      where: { dataset_id: datasetId },
    })

    if (!job) {
      throw new Error('Job not found')
    }

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Get all existing example hashes to ensure uniqueness
    const existingHashes = await getAllExistingExampleHashes()
    const currentJobHashes = new Set<string>() // Track hashes for current job to avoid duplicates within the same job
    const allExamples: Array<{
      messages: Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
      }>
    }> = []

    // Get the target number of examples from metadata or calculate from batches
    const metadata = job.metadata as Record<string, unknown> | null
    const targetExamples = metadata && typeof metadata === 'object' && 'target_examples' in metadata
      ? (metadata.target_examples as number)
      : job.total_batches * 5

    // Process in batches
    for (let batch = 0; batch < job.total_batches; batch++) {
      const batchCount = Math.min(5, targetExamples - (batch * 5))
      if (batchCount <= 0) break

      try {
        // Generate batch with uniqueness check
        const batchExamples = await generateBatch(
          job.title,
          job.description || '',
          batchCount,
          job.dataset_type as 'chat' | 'calling' | 'voice' | 'all',
          openaiApiKey
        )

        // Filter out duplicates (both from existing datasets and within current job)
        const uniqueBatchExamples: Array<{
          messages: Array<{
            role: 'user' | 'assistant' | 'system'
            content: string
          }>
        }> = []

        for (const example of batchExamples) {
          const hash = createExampleHash(example)
          
          // Skip if duplicate exists in other datasets or current job
          if (existingHashes.has(hash) || currentJobHashes.has(hash)) {
            logger.debug('Skipping duplicate example', {
              extraData: { dataset_id: datasetId, batch, hash: hash.substring(0, 8) },
            })
            continue
          }

          // Add to unique examples and track hash
          uniqueBatchExamples.push(example)
          currentJobHashes.add(hash)
        }

        // If we lost examples due to duplicates, try to generate more
        let attempts = 0
        const maxRetryAttempts = 3
        while (uniqueBatchExamples.length < batchCount && attempts < maxRetryAttempts) {
          const needed = batchCount - uniqueBatchExamples.length
          logger.info(`Regenerating ${needed} examples due to duplicates`, {
            extraData: { dataset_id: datasetId, batch, attempt: attempts + 1 },
          })

          const additionalExamples = await generateBatch(
            job.title,
            job.description || '',
            needed,
            job.dataset_type as 'chat' | 'calling' | 'voice' | 'all',
            openaiApiKey
          )

          for (const example of additionalExamples) {
            const hash = createExampleHash(example)
            
            if (existingHashes.has(hash) || currentJobHashes.has(hash)) {
              continue
            }

            uniqueBatchExamples.push(example)
            currentJobHashes.add(hash)

            if (uniqueBatchExamples.length >= batchCount) {
              break
            }
          }

          attempts++
        }

        allExamples.push(...uniqueBatchExamples)

        // Update progress
        const progress = Math.floor(((batch + 1) / job.total_batches) * 100)
        const updatedDataset = await prisma.dataset.update({
          where: { dataset_id: datasetId },
          data: {
            current_batch: batch + 1,
            progress,
            generated_count: allExamples.length,
          },
        })

        // Emit WebSocket progress event
        try {
          emitDatasetProgress(updatedDataset)
        } catch (error) {
          logger.warning('Failed to emit dataset progress WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
        }

          // Notify admins about progress (every 10% or every 5 batches)
          if (progress % 10 === 0 || (batch + 1) % 5 === 0) {
            try {
              const { notifyDatasetGenerationProgress } = await import('@lib/notifications/bot-notifications')
              await notifyDatasetGenerationProgress({
                job_id: datasetId,
                title: job.title,
                progress,
                current_batch: batch + 1,
                total_batches: job.total_batches,
                generated_count: allExamples.length,
              })
            } catch {
              // Ignore notification errors during processing
            }
          }

        // Small delay between batches to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (batchError: unknown) {
              const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error'
              logger.error('Error generating batch', {
                extraData: { dataset_id: datasetId, batch, error: errorMessage },
              })
              // Continue with next batch even if one fails
            }
    }

    // Validate all examples before final processing
    const validatedExamples = allExamples.filter(ex => {
      if (!ex || !ex.messages || !Array.isArray(ex.messages)) {
        logger.warning('Filtering out invalid example', {
          extraData: { dataset_id: datasetId },
        })
        return false
      }
      // Ensure each example is a valid JSON object
      try {
        const jsonString = JSON.stringify(ex)
        JSON.parse(jsonString) // Validate it can be parsed back
        return true
      } catch (error) {
        logger.warning('Filtering out example with invalid JSON', {
          extraData: { 
            dataset_id: datasetId,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
        })
        return false
      }
    })

    if (validatedExamples.length === 0) {
      throw new Error('No valid examples generated after validation')
    }

    // Log uniqueness statistics
    logger.info('Dataset generation completed with uniqueness check', {
      extraData: {
        dataset_id: datasetId,
        total_examples: allExamples.length,
        validated_examples: validatedExamples.length,
        unique_examples: validatedExamples.length,
        existing_hashes_checked: existingHashes.size,
      },
    })

    // Split into 80/20 train/test
    const trainingCount = Math.floor(validatedExamples.length * 0.8)
    const trainingExamples = validatedExamples.slice(0, trainingCount)
    const testExamples = validatedExamples.slice(trainingCount)

    // Helper function to convert examples to JSONL format
    // JSONL = one valid JSON object per line, separated by newlines
    const convertToJSONL = (examples: Array<{
      messages: Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
      }>
    }>): string => {
      const lines: string[] = []
      
      for (const ex of examples) {
        try {
          // Ensure it's a valid JSON object
          if (!ex || !ex.messages || !Array.isArray(ex.messages)) {
            continue
          }
          
          // Create a clean example object
          const cleanExample = {
            messages: ex.messages.map(msg => ({
              role: msg.role,
              content: String(msg.content || '').trim()
            })).filter(msg => msg.content.length > 0)
          }
          
          // Validate it has at least user and assistant messages
          const hasUser = cleanExample.messages.some(m => m.role === 'user')
          const hasAssistant = cleanExample.messages.some(m => m.role === 'assistant')
          
          if (!hasUser || !hasAssistant || cleanExample.messages.length < 2) {
            continue
          }
          
          // Convert to JSON string and validate
          const jsonString = JSON.stringify(cleanExample)
          JSON.parse(jsonString) // Validate it can be parsed back
          
          lines.push(jsonString)
        } catch (error) {
          logger.warning('Skipping invalid example during JSONL conversion', {
            extraData: { 
              error: error instanceof Error ? error.message : 'Unknown error',
              dataset_id: datasetId
            },
          })
          continue
        }
      }
      
      // Join with newlines - this is proper JSONL format
      return lines.join('\n')
    }

    // Convert to JSONL format (one JSON object per line)
    const fullContent = convertToJSONL(validatedExamples)
    const trainingContent = convertToJSONL(trainingExamples)
    const testContent = convertToJSONL(testExamples)
    
    // Final validation: ensure JSONL can be parsed line by line
    const validateJSONL = (jsonl: string): boolean => {
      if (!jsonl || !jsonl.trim()) return false
      const lines = jsonl.split('\n').filter(line => line.trim())
      for (const line of lines) {
        try {
          JSON.parse(line)
        } catch {
          return false
        }
      }
      return true
    }
    
    if (!validateJSONL(fullContent)) {
      throw new Error('Generated JSONL content is invalid')
    }

    // Update dataset with generated content and mark as completed
    // Data is stored in JSONL format (one JSON object per line) - optimal for OpenAI fine-tuning
    const completedDataset = await prisma.dataset.update({
      where: { dataset_id: datasetId },
      data: {
        content: fullContent,
        training_content: trainingContent,
        test_content: testContent,
        num_examples: validatedExamples.length,
        training_examples_count: trainingExamples.length,
        test_examples_count: testExamples.length,
        status: 'completed',
        progress: 100,
        generated_count: validatedExamples.length,
        completed_at: new Date(),
        metadata: {
          ...((job.metadata as object) || {}),
          generated_at: new Date().toISOString(),
          generation_method: 'chatgpt',
          split: {
            training_count: trainingCount,
            test_count: testExamples.length,
            training_percentage: 80,
            test_percentage: 20,
          },
        },
      },
    })

    // Emit WebSocket event for completion
    try {
      emitDatasetUpdated(completedDataset)
    } catch (error) {
      logger.warning('Failed to emit dataset updated WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    // Notify admins about completion
    try {
      const { notifyDatasetGenerationCompleted } = await import('@lib/notifications/bot-notifications')
      await notifyDatasetGenerationCompleted({
        job_id: datasetId,
        dataset_id: datasetId,
        title: job.title,
        num_examples: allExamples.length,
      })
    } catch (notifError) {
      logger.warning('Failed to send notification for dataset generation completed', {
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
      })
    }

    logger.info('Dataset generation job completed', {
      extraData: {
        dataset_id: datasetId,
        examples: allExamples.length,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Update dataset as failed
    const failedJob = await prisma.dataset.findUnique({
      where: { dataset_id: datasetId },
      select: { title: true },
    }).catch(() => null)

    await prisma.dataset.update({
      where: { dataset_id: datasetId },
      data: {
        status: 'failed',
        error: {
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      },
    }).then((failedDataset) => {
      // Emit WebSocket event for failure
      if (failedDataset) {
        try {
          emitDatasetUpdated(failedDataset)
        } catch (error) {
          logger.warning('Failed to emit dataset updated WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
        }
      }
    }).catch(() => {
      // Ignore update errors
    })

    // Notify admins about failure
    try {
      const { notifyDatasetGenerationFailed } = await import('@lib/notifications/bot-notifications')
      await notifyDatasetGenerationFailed({
        job_id: datasetId,
        title: failedJob?.title || 'Unknown',
        error: errorMessage,
      })
    } catch (notifError) {
      logger.warning('Failed to send notification for dataset generation failed', {
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
      })
    }

    logger.error('Dataset generation job failed', {
      extraData: { dataset_id: datasetId, error: errorMessage },
    })
  }
}

/**
 * Generate a batch of examples
 */
async function generateBatch(
  title: string,
  description: string,
  count: number,
  datasetType: 'chat' | 'calling' | 'voice' | 'all',
  apiKey: string
): Promise<Array<{
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const typeInstruction =
      datasetType === 'chat'
        ? 'Chat interactions - text-based conversations.'
        : datasetType === 'calling'
        ? 'Phone call interactions - concise, natural speech.'
        : datasetType === 'voice'
        ? 'Voice assistant interactions - clear, concise responses.'
        : 'All interaction types - versatile and natural.'

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a training data generator. Generate ${count} conversation examples in JSON format. Each example must be a valid JSON object with a "messages" array containing user and assistant messages. Return ONLY a valid JSON object with this exact structure: {"examples": [{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}]}. Do NOT return multiple JSON objects. Do NOT concatenate JSON objects. Return a single valid JSON object. Keep assistant responses concise (1-2 sentences). Interaction type: ${typeInstruction}`,
          },
          {
            role: 'user',
            content: `Topic: ${title}\nDescription: ${description}\n\nGenerate exactly ${count} unique conversation examples. Each example must have both a user message and an assistant response. Return a single JSON object with this structure:\n{"examples": [{"messages": [{"role": "user", "content": "question"}, {"role": "assistant", "content": "answer"}]}]}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000, // Increased to handle more examples
        response_format: { type: 'json_object' },
      }),
    })

    clearTimeout(timeoutId)

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      throw new Error(`OpenAI API error: ${errorData.error?.message || `HTTP ${response.status}`}`)
    }

    const data = await response.json()
    let content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    // Clean up the content - remove markdown code blocks if present
    content = content.trim()
    if (content.startsWith('```')) {
      // Remove markdown code blocks
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    }

    // Fix common JSON formatting issues
    // If multiple JSON objects are concatenated, try to split them
    // But first, try to parse as single JSON object
    let parsedContent: { examples?: unknown[]; data?: unknown[] } | unknown[]
    
    try {
      // First attempt: parse as single JSON object
      parsedContent = JSON.parse(content) as { examples?: unknown[]; data?: unknown[] } | unknown[]
    } catch (parseError) {
      // If parsing fails, try to fix concatenated JSON objects
      logger.warning('Failed to parse JSON, attempting to fix concatenated objects', {
        extraData: { contentPreview: content.substring(0, 200) },
      })
      
      // Try to extract JSON from markdown or find JSON array
      const jsonMatch = content.match(/```(?:json)?\s*(\[{[\s\S]*}\])\s*```/) || content.match(/(\[{[\s\S]*}\])/)
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[1]) as { examples?: unknown[]; data?: unknown[] } | unknown[]
        } catch {
          // If still fails, try to split concatenated JSON objects
          // Look for pattern: }{ and split there
          const fixedContent = content.replace(/}\s*{/g, '}\n{')
          // Try to parse each line as separate JSON object
          const lines = fixedContent.split('\n').filter((line: string) => line.trim())
          const parsedObjects: unknown[] = []
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.trim())
              parsedObjects.push(parsed)
            } catch {
              // Skip invalid lines
              continue
            }
          }
          
          if (parsedObjects.length > 0) {
            // If we have multiple objects, wrap them in an examples array
            parsedContent = { examples: parsedObjects }
          } else {
            throw new Error('Failed to parse JSON from OpenAI response after fixing attempts')
          }
        }
      } else {
        throw new Error('Failed to parse JSON from OpenAI response: ' + (parseError instanceof Error ? parseError.message : 'Unknown error'))
      }
    }

    // Extract examples
    let examples: Array<{ messages?: Array<{ role?: string; content?: string }> }> = []
    if (Array.isArray(parsedContent)) {
      examples = parsedContent as Array<{ messages?: Array<{ role?: string; content?: string }> }>
    } else if (typeof parsedContent === 'object' && parsedContent !== null && 'examples' in parsedContent && Array.isArray(parsedContent.examples)) {
      examples = parsedContent.examples as Array<{ messages?: Array<{ role?: string; content?: string }> }>
    } else if (typeof parsedContent === 'object' && parsedContent !== null && 'data' in parsedContent && Array.isArray(parsedContent.data)) {
      examples = parsedContent.data as Array<{ messages?: Array<{ role?: string; content?: string }> }>
    }

    // Validate and normalize
    const validExamples: Array<{
      messages: Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
      }>
    }> = []

    for (const example of examples) {
      if (example && example.messages && Array.isArray(example.messages)) {
        const normalized = {
          messages: example.messages
            .map((msg: { role?: string; content?: string }) => ({
              role: (msg.role || 'user') as 'user' | 'assistant' | 'system',
              content: msg.content || '',
            }))
            .filter((msg: { role: string; content: string }) => msg.content && ['user', 'assistant', 'system'].includes(msg.role)),
        }

        const hasUser = normalized.messages.some((m: { role: string }) => m.role === 'user')
        const hasAssistant = normalized.messages.some((m: { role: string }) => m.role === 'assistant')

        if (hasUser && hasAssistant && normalized.messages.length >= 2) {
          validExamples.push(normalized)
        }
      }
    }

    return validExamples
  } catch {
    clearTimeout(timeoutId)
    // Return fallback examples if generation fails
    return generateFallbackExamples(title, description, count)
  }
}

/**
 * Fallback examples generator
 */
function generateFallbackExamples(
  title: string,
  description: string,
  count: number
  // datasetType parameter removed as it's not used
): Array<{
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}> {
  const examples: Array<{
    messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }>
  }> = []

  const questions = [
    'What is {topic}?',
    'Tell me about {topic}',
    'Can you explain {topic}?',
    'How does {topic} work?',
    'What are the benefits of {topic}?',
  ]

  for (let i = 0; i < count; i++) {
    const question = questions[i % questions.length].replace(/{topic}/g, title)
    const answer = `${description} This is what ${title} is about.`

    examples.push({
      messages: [
        { role: 'user', content: question },
        { role: 'assistant', content: answer },
      ],
    })
  }

  return examples
}
