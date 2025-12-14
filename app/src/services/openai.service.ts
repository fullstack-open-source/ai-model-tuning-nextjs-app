/**
 * OpenAI Service
 * Handles AI-powered responses for support tickets
 */

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class OpenAIService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.openai.com/v1';
  private model = 'gpt-4o-mini'; // Using cost-effective model

  constructor() {
    // Try both environment variable names
    this.apiKey = process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY || null;
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. AI features will be disabled.');
    }
  }

  /**
   * Check if OpenAI is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate AI response for a support ticket
   */
  async generateTicketResponse(
    subject: string,
    description: string,
    category: string,
    priority: string,
    ticketNumber: string
  ): Promise<OpenAIResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    try {
      const systemPrompt = `You are a professional customer support assistant. Your role is to:
1. Understand the customer's issue from their ticket description
2. Provide helpful, empathetic, and accurate responses
3. Ask clarifying questions if needed
4. Offer solutions or next steps
5. Be concise but thorough (2-4 sentences)
6. Use a friendly and professional tone

Always acknowledge the customer's concern and provide actionable guidance.`;

      const userPrompt = `A customer has created a support ticket with the following details:

Ticket Number: ${ticketNumber}
Subject: ${subject}
Category: ${category}
Priority: ${priority}
Description: ${description}

Please provide a helpful initial response that:
- Acknowledges their issue
- Shows understanding of their concern
- Provides helpful guidance or next steps
- Invites them to provide more details if needed

Keep the response professional, empathetic, and concise.`;

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiMessage = data.choices?.[0]?.message?.content;

      if (!aiMessage) {
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        message: aiMessage.trim(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OpenAI API error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate follow-up response based on conversation context
   */
  async generateFollowUpResponse(
    ticketSubject: string,
    ticketDescription: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; message: string }>,
    userMessage: string
  ): Promise<OpenAIResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    try {
      const systemPrompt = `You are a professional customer support assistant helping with a support ticket. 
Continue the conversation naturally, addressing the customer's latest message while keeping context of the entire conversation.
Be helpful, empathetic, and solution-oriented.`;

      const conversationContext = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Customer' : 'Support'}: ${msg.message}`)
        .join('\n');

      const userPrompt = `Original Ticket:
Subject: ${ticketSubject}
Description: ${ticketDescription}

Conversation History:
${conversationContext}

Latest Customer Message: ${userMessage}

Please provide a helpful response that continues the conversation naturally.`;

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiMessage = data.choices?.[0]?.message?.content;

      if (!aiMessage) {
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        message: aiMessage.trim(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OpenAI API error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const openAIService = new OpenAIService();

