import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { config } from '../config/index.js';
import { withRetry } from '../utils/retry.js';
import { logLLMCall } from '../utils/logger.js';
import type { AgentConfig, Message } from '../types/index.js';

// ============================================================================
// OpenAI Service (Wrapper with Best Practices)
// ============================================================================

export class OpenAIService {
  private client: OpenAI;
  private config: AgentConfig;

  constructor(agentConfig?: Partial<AgentConfig>) {
    const apiKey = config.openai.apiKey;
    
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required for AI features. ' +
        'Set it in your .env file or use --tools flag for tools-only demo.'
      );
    }

    this.client = new OpenAI({
      apiKey,
    });
    this.config = config.getAgentConfig(agentConfig);
  }

  // ============================================================================
  // Chat Completion
  // ============================================================================

  async complete(
    messages: Message[],
    options?: {
      tools?: ChatCompletionTool[];
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const openaiMessages = this.toOpenAIMessages(messages);

    const startTime = Date.now();

    const completion = await withRetry(
      () =>
        this.client.chat.completions.create({
          model: this.config.model,
          messages: openaiMessages,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          tools: options?.tools,
          tool_choice: options?.toolChoice,
        }),
      {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelayMs,
      }
    );

    const durationMs = Date.now() - startTime;

    logLLMCall(
      this.config.model,
      {
        prompt: completion.usage?.prompt_tokens ?? 0,
        completion: completion.usage?.completion_tokens ?? 0,
      },
      durationMs
    );

    return completion;
  }

  // ============================================================================
  // Streaming Chat Completion
  // ============================================================================

  async *completeStream(
    messages: Message[],
    options?: {
      tools?: ChatCompletionTool[];
    }
  ): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
    const openaiMessages = this.toOpenAIMessages(messages);

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: openaiMessages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      tools: options?.tools,
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  // ============================================================================
  // Structured Output (JSON Mode)
  // ============================================================================

  async completeJson<T>(messages: Message[], schema?: object): Promise<T> {
    const systemMessage: Message = {
      role: 'system',
      content: schema
        ? `You must respond with valid JSON that matches this schema: ${JSON.stringify(schema)}`
        : 'You must respond with valid JSON only.',
    };

    const completion = await withRetry(
      () =>
        this.client.chat.completions.create({
          model: this.config.model,
          messages: this.toOpenAIMessages([systemMessage, ...messages]),
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          response_format: { type: 'json_object' },
        }),
      {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelayMs,
      }
    );

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in completion response');
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(`Failed to parse JSON response: ${content}`);
    }
  }

  // ============================================================================
  // Embeddings
  // ============================================================================

  async createEmbedding(text: string): Promise<number[]> {
    const response = await withRetry(
      () =>
        this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        }),
      {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelayMs,
      }
    );

    const embedding = response.data[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding returned');
    }

    return embedding;
  }

  async createEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await withRetry(
      () =>
        this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelayMs,
      }
    );

    return response.data.map((d) => d.embedding);
  }

  // ============================================================================
  // Message Conversion
  // ============================================================================

  private toOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId ?? '',
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
        name: msg.name,
      };
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  getModel(): string {
    return this.config.model;
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let openaiServiceInstance: OpenAIService | null = null;

export function getOpenAIService(config?: Partial<AgentConfig>): OpenAIService {
  if (!openaiServiceInstance) {
    openaiServiceInstance = new OpenAIService(config);
  }
  return openaiServiceInstance;
}

