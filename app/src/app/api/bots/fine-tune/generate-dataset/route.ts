import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'

type DatasetType = 'chat' | 'calling' | 'voice' | 'all'

/**
 * Generate training dataset using ChatGPT
 * POST /api/fine-tune/generate-dataset
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

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return ERROR.json('OPENAI_API_KEY_NOT_CONFIGURED', {})
    }

    // Generate training examples using ChatGPT
    const examples = await generateTrainingExamplesWithChatGPT(
      title,
      description,
      num_examples,
      dataset_type as DatasetType,
      openaiApiKey
    )

    // Split dataset into 80% training and 20% testing
    const totalExamples = examples.length
    const trainingCount = Math.floor(totalExamples * 0.8)
    const testCount = totalExamples - trainingCount

    const trainingExamples = examples.slice(0, trainingCount)
    const testExamples = examples.slice(trainingCount)

    // Convert to JSONL format
    const trainingContent = trainingExamples.map(example => JSON.stringify(example)).join('\n')
    const testContent = testExamples.map(example => JSON.stringify(example)).join('\n')
    const fullContent = examples.map(example => JSON.stringify(example)).join('\n')

    // Save dataset to database for future reference (with split info)
    let savedDataset = null
    try {
      savedDataset = await prisma.dataset.create({
        data: {
          title,
          description: description || null,
          dataset_type: dataset_type as string,
          content: fullContent, // Store full dataset
          num_examples: examples.length,
          created_by: user?.uid || user?.user_id || null,
          metadata: {
            generated_at: new Date().toISOString(),
            generation_method: 'chatgpt',
            original_request: {
              title,
              description,
              num_examples,
              dataset_type,
            },
            split: {
              training_count: trainingCount,
              test_count: testCount,
              training_percentage: 80,
              test_percentage: 20,
            },
          },
        },
      })
      logger.info('Dataset saved to database with train/test split', {
        extraData: {
          dataset_id: savedDataset.dataset_id,
          title,
          total_examples: examples.length,
          training_count: trainingCount,
          test_count: testCount,
        },
      })
    } catch (saveError: unknown) {
      const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error'
      logger.error('Error saving dataset to database', {
        extraData: { error: errorMessage, title },
      })
      // Continue even if save fails - still return the generated dataset
    }

    logger.info('Dataset generated successfully', {
      extraData: {
        title,
        num_examples: examples.length,
        dataset_type,
        saved: savedDataset !== null,
      },
    })

    return SUCCESS.json('Dataset generated successfully', {
      content: fullContent, // Full dataset
      training_content: trainingContent, // 80% training set
      test_content: testContent, // 20% test set
      examples: examples as unknown[],
      training_examples: trainingExamples as unknown[],
      test_examples: testExamples as unknown[],
      count: examples.length,
      training_count: trainingCount,
      test_count: testCount,
      dataset_id: savedDataset?.dataset_id || null, // Include saved dataset ID
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error generating dataset', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Generate training examples using ChatGPT API
 */
async function generateTrainingExamplesWithChatGPT(
  title: string,
  description: string,
  count: number,
  datasetType: DatasetType,
  apiKey: string
): Promise<Array<{
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}>> {
  const examples: Array<{
    messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }>
  }> = []

  // Generate examples in very small batches to avoid timeouts
  // For large counts, use smaller batches; for small counts, use slightly larger batches
  const batchSize = count > 50 ? 3 : count > 20 ? 5 : 10 // Smaller batches for large requests
  const batches = Math.ceil(count / batchSize)
  
  // Build concise system prompt based on dataset type to reduce token usage
  let typeInstruction = ''
  if (datasetType === 'chat') {
    typeInstruction = 'Text-based chat interactions.'
  } else if (datasetType === 'calling') {
    typeInstruction = 'Phone call interactions - concise, natural speech.'
  } else if (datasetType === 'voice') {
    typeInstruction = 'Voice assistant - clear, concise speech.'
  } else {
    typeInstruction = 'All interaction types - versatile and natural.'
  }
  
  // Simplified system prompt to reduce token usage
  const systemPrompt = `Generate training data. Format: {"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}. Keep responses concise (1-2 sentences). Type: ${typeInstruction} Return JSON: {"examples": [...]}`

  // Limit total batches to avoid very long processing
  const maxBatches = 20 // Maximum 20 batches (60-100 examples with current batch size)
  const actualBatches = Math.min(batches, maxBatches)
  
  for (let batch = 0; batch < actualBatches; batch++) {
    const batchCount = Math.min(batchSize, count - (batch * batchSize))
    if (batchCount <= 0) break

    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout per batch

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use cost-effective model
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `Topic: ${title}\nDescription: ${description}\n\nGenerate ${batchCount} examples. Return JSON: {"examples": [{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}]}`,
            },
          ],
          temperature: 0.7, // Lower for faster, more consistent responses
          max_tokens: 1000, // Further reduced for faster responses
          response_format: { type: 'json_object' }, // Request JSON format
        }),
      })

      clearTimeout(timeoutId)

      if (response.status !== 200) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        logger.error('OpenAI API error', { extraData: { error: errorData, status: response.status } })
        throw new Error(`OpenAI API error: ${errorData.error?.message || `HTTP ${response.status}`}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No content received from OpenAI')
      }

      // Parse the JSON response
      type ParsedContent = {
        examples?: Array<{ messages: Array<{ role: string; content: string }> }>
        data?: Array<{ messages: Array<{ role: string; content: string }> }>
        [key: string]: unknown
      } | Array<{ messages: Array<{ role: string; content: string }> }>

      let parsedContent: ParsedContent
      try {
        parsedContent = JSON.parse(content) as ParsedContent
      } catch {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\[{[\s\S]*}\])\s*```/) || content.match(/(\[{[\s\S]*}\])/)
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[1]) as ParsedContent
        } else {
          throw new Error('Failed to parse JSON from OpenAI response')
        }
      }

      // Extract examples from response
      type ExampleType = { messages: Array<{ role: string; content: string }> }
      let batchExamples: ExampleType[] = []
      if (Array.isArray(parsedContent)) {
        batchExamples = parsedContent
      } else if (typeof parsedContent === 'object' && parsedContent !== null) {
        if ('examples' in parsedContent && Array.isArray(parsedContent.examples)) {
          batchExamples = parsedContent.examples
        } else if ('data' in parsedContent && Array.isArray(parsedContent.data)) {
          batchExamples = parsedContent.data
        } else {
          // Try to find any array in the response
          for (const key in parsedContent) {
            const value = parsedContent[key]
            if (Array.isArray(value)) {
              batchExamples = value as ExampleType[]
              break
            }
          }
        }
      }

      // Validate and normalize examples
      for (const example of batchExamples) {
        if (example && example.messages && Array.isArray(example.messages)) {
          // Ensure proper structure
          const normalizedExample = {
            messages: example.messages
              .map((msg: { role?: string; content?: string }) => ({
                role: (msg.role || 'user') as 'user' | 'assistant' | 'system',
                content: msg.content || '',
              }))
              .filter((msg: { role: string; content: string }) => 
                msg.content && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
              ) as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
          }

          // Must have at least one user and one assistant message
          const hasUser = normalizedExample.messages.some((m) => m.role === 'user')
          const hasAssistant = normalizedExample.messages.some((m) => m.role === 'assistant')

          if (hasUser && hasAssistant && normalizedExample.messages.length >= 2) {
            examples.push(normalizedExample)
          }
        }
      }

      // If we got fewer examples than requested, generate more
      if (examples.length < (batch + 1) * batchSize && batch < batches - 1) {
        // Continue to next batch
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || errorMessage.includes('timeout'))
      
      logger.error('Error generating batch', { extraData: { error: errorMessage, batch, isTimeout } })
      
      // If timeout and we have some examples, continue with fallback for remaining
      if (isTimeout && examples.length > 0) {
        logger.error('Timeout occurred, using fallback for remaining examples', { extraData: { batch, examplesSoFar: examples.length } })
        const remaining = count - examples.length
        if (remaining > 0) {
          const fallbackExamples = generateFallbackExamples(title, description, remaining, datasetType)
          examples.push(...fallbackExamples)
        }
        break
      }
      
      // Fallback: generate simple examples if ChatGPT fails completely
      if (examples.length === 0) {
        logger.error('ChatGPT generation failed, using fallback', { extraData: { error: errorMessage } })
        const fallbackExamples = generateFallbackExamples(title, description, count, datasetType)
        examples.push(...fallbackExamples)
        break
      }
      
      // Continue with what we have if partial success
      break
    }
  }

  // If we still don't have enough examples, generate simple fallback examples
  if (examples.length < count) {
    const remaining = count - examples.length
    logger.error('Insufficient examples generated, using fallback', { 
      extraData: { 
        requested: count, 
        generated: examples.length, 
        remaining 
      } 
    })
    const fallbackExamples = generateFallbackExamples(title, description, remaining, datasetType)
    examples.push(...fallbackExamples)
  }
  
  // Log performance metrics
  logger.info('Dataset generation completed', {
    extraData: {
      requested: count,
      generated: examples.length,
      batchesProcessed: actualBatches,
    },
  })

  // Trim to exact count
  return examples.slice(0, count)
}

/**
 * Fallback function to generate simple examples if ChatGPT fails
 */
function generateFallbackExamples(
  title: string,
  description: string,
  count: number,
  datasetType: DatasetType
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

  const questionTemplates = [
    'What is {topic}?',
    'Tell me about {topic}',
    'Can you explain {topic}?',
    'How does {topic} work?',
    'What are the benefits of {topic}?',
    'What are the features of {topic}?',
    'Describe {topic}',
    'What do you know about {topic}?',
    'Give me information about {topic}',
    'What is the purpose of {topic}?',
    'How can I use {topic}?',
    'What are the types of {topic}?',
    'What are examples of {topic}?',
    'What is the importance of {topic}?',
    'What are the characteristics of {topic}?',
  ]

  for (let i = 0; i < count; i++) {
    const questionTemplate = questionTemplates[i % questionTemplates.length]
    const question = questionTemplate.replace(/{topic}/g, title)

    let answer = `${title} is ${description.toLowerCase()}.`
    
    if (datasetType === 'calling' || datasetType === 'voice') {
      answer += ' How can I help you with this?'
    } else if (datasetType === 'chat') {
      answer += ' Would you like to know more?'
    } else {
      answer += ' Feel free to ask if you need more information.'
    }

    examples.push({
      messages: [
        {
          role: 'user',
          content: question,
        },
        {
          role: 'assistant',
          content: answer,
        },
      ],
    })
  }

  return examples
}

