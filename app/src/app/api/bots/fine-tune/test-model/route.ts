import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { Prisma } from '@prisma/client'


/**
 * Test fine-tuned model and generate accuracy report
 * POST /api/fine-tune/test-model
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const body = await req.json()
    const {
      fine_tune_job_id,
      bot_id,
      dataset_id,
      training_file_id,
      test_file_id,
      model_id, // Fine-tuned model ID
      test_examples, // Test examples array
    } = body

    if (!model_id || !test_examples || !Array.isArray(test_examples) || test_examples.length === 0) {
      return ERROR.json('MISSING_REQUIRED_FIELDS', {
        fields: ['model_id', 'test_examples'],
      })
    }

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return ERROR.json('OPENAI_API_KEY_NOT_CONFIGURED', {})
    }

    // Create report with pending status
    const report = await prisma.trainingReport.create({
      data: {
        fine_tune_job_id: fine_tune_job_id || null,
        bot_id: bot_id || null,
        dataset_id: dataset_id || null,
        training_file_id: training_file_id || null,
        test_file_id: test_file_id || null,
        training_examples: 0, // Will be updated
        test_examples: test_examples.length,
        model_name: model_id,
        fine_tuned_model: model_id,
        status: 'testing',
        created_by: user?.uid || user?.user_id || null,
      },
    })

    try {
      // Update status to testing
      await prisma.trainingReport.update({
        where: { report_id: report.report_id },
        data: { status: 'testing' },
      })

      // Test the model with test examples
      const testResults = await testModelWithExamples(model_id, test_examples, openaiApiKey)

      // Calculate accuracy metrics
      const metrics = calculateMetrics(testResults)

      // Update report with results
      const updatedReport = await prisma.trainingReport.update({
        where: { report_id: report.report_id },
        data: {
          status: 'completed',
          accuracy: metrics.accuracy,
          precision: metrics.precision,
          recall: metrics.recall,
          f1_score: metrics.f1Score,
          perplexity: metrics.perplexity,
          detailed_metrics: metrics.detailed as Prisma.InputJsonValue,
          confusion_matrix: metrics.confusionMatrix as Prisma.InputJsonValue,
          test_results: testResults,
          completed_at: new Date(),
        },
      })

      logger.info('Model testing completed', {
        extraData: {
          report_id: updatedReport.report_id,
          accuracy: metrics.accuracy,
          model_id,
        },
      })

      return SUCCESS.json('Model testing completed successfully', updatedReport)
    } catch (testError: unknown) {
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown error'
      
      // Update report with error
      await prisma.trainingReport.update({
        where: { report_id: report.report_id },
        data: {
          status: 'failed',
          error: {
            message: errorMessage,
            timestamp: new Date().toISOString(),
          },
        },
      })

      logger.error('Error testing model', {
        extraData: {
          error: errorMessage,
          report_id: report.report_id,
        },
      })

      return ERROR.json('TESTING_FAILED', { error: errorMessage }, testError)
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error in test-model endpoint', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Test model with test examples
 */
async function testModelWithExamples(
  modelId: string,
  testExamples: Array<{ messages: Array<{ role: string; content: string }> }>,
  apiKey: string
): Promise<Array<{
  input: string
  expected: string
  predicted: string
  correct: boolean
  similarity: number
}>> {
  const results: Array<{
    input: string
    expected: string
    predicted: string
    correct: boolean
    similarity: number
  }> = []

  for (const example of testExamples) {
    const userMessage = example.messages.find((m) => m.role === 'user')
    const assistantMessage = example.messages.find((m) => m.role === 'assistant')

    if (!userMessage || !assistantMessage) continue

    const input = userMessage.content
    const expected = assistantMessage.content

    try {
      // Call the fine-tuned model
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      })

      if (response.status !== 200) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        throw new Error(`OpenAI API error: ${errorData.error?.message || `HTTP ${response.status}`}`)
      }

      const data = await response.json()
      const predicted = data.choices?.[0]?.message?.content || ''

      // Calculate similarity (simple word overlap)
      const similarity = calculateSimilarity(expected, predicted)
      const correct = similarity >= 0.7 // 70% similarity threshold

      results.push({
        input,
        expected,
        predicted,
        correct,
        similarity,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Error testing example', {
        extraData: { error: errorMessage, input },
      })
      
      results.push({
        input,
        expected,
        predicted: '',
        correct: false,
        similarity: 0,
      })
    }
  }

  return results
}

/**
 * Calculate similarity between two strings (simple word overlap)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/)
  const words2 = str2.toLowerCase().split(/\s+/)
  
  const set1 = new Set(words1)
  const set2 = new Set(words2)
  
  const intersection = new Set([...set1].filter((x) => set2.has(x)))
  const union = new Set([...set1, ...set2])
  
  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * Calculate accuracy metrics from test results
 */
function calculateMetrics(testResults: Array<{
  input: string
  expected: string
  predicted: string
  correct: boolean
  similarity: number
}>): {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  perplexity: number
  detailed: Record<string, unknown>
  confusionMatrix: Record<string, unknown>
} {
  const total = testResults.length
  if (total === 0) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      perplexity: 0,
      detailed: {},
      confusionMatrix: {},
    }
  }

  // Calculate accuracy
  const correct = testResults.filter((r) => r.correct).length
  const accuracy = correct / total

  // Calculate average similarity
  const avgSimilarity = testResults.reduce((sum, r) => sum + r.similarity, 0) / total

  // For precision/recall, we use similarity-based metrics
  // True Positives: High similarity predictions
  const tp = testResults.filter((r) => r.similarity >= 0.7).length
  // False Positives: Low similarity but marked as correct
  const fp = testResults.filter((r) => r.similarity < 0.7 && r.correct).length
  // False Negatives: High similarity but marked as incorrect
  const fn = testResults.filter((r) => r.similarity >= 0.7 && !r.correct).length

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  // Calculate perplexity (simplified - based on prediction confidence)
  const perplexity = testResults.reduce((sum, r) => {
    // Use similarity as a proxy for confidence
    const confidence = r.similarity
    return sum + (confidence > 0 ? -Math.log(confidence) : 10) // Penalize low confidence
  }, 0) / total

  // Detailed metrics
  const detailed = {
    total_tests: total,
    correct_predictions: correct,
    incorrect_predictions: total - correct,
    average_similarity: avgSimilarity,
    similarity_distribution: {
      high: testResults.filter((r) => r.similarity >= 0.8).length,
      medium: testResults.filter((r) => r.similarity >= 0.5 && r.similarity < 0.8).length,
      low: testResults.filter((r) => r.similarity < 0.5).length,
    },
  }

  // Confusion matrix (simplified)
  const confusionMatrix = {
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    true_negatives: total - tp - fp - fn,
  }

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    perplexity,
    detailed,
    confusionMatrix,
  }
}

