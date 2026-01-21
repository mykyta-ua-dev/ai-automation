import { z } from 'zod';
import dotenv from 'dotenv';
import type { AgentConfig } from '../types/index.js';

// Load environment variables
dotenv.config();

// ============================================================================
// Environment Schema with Validation
// ============================================================================

const EnvSchema = z.object({
  // OpenAI Configuration (optional for tools-only mode)
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),

  // Application Configuration
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  MAX_RETRIES: z.coerce.number().int().positive().default(3),
  RETRY_DELAY_MS: z.coerce.number().int().positive().default(1000),

  // Feature Flags
  ENABLE_STREAMING: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_TOOL_CALLS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

type Env = z.infer<typeof EnvSchema>;

// ============================================================================
// Configuration Class (Singleton Pattern)
// ============================================================================

class Configuration {
  private static instance: Configuration;
  private env: Env;

  private constructor() {
    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
      const errors = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Configuration validation failed:\n${errors}`);
    }

    this.env = result.data;
  }

  public static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  // ============================================================================
  // Getters for Type-Safe Configuration Access
  // ============================================================================

  get openai() {
    return {
      apiKey: this.env.OPENAI_API_KEY,
      model: this.env.OPENAI_MODEL,
    };
  }

  get logging() {
    return {
      level: this.env.LOG_LEVEL,
    };
  }

  get retry() {
    return {
      maxRetries: this.env.MAX_RETRIES,
      delayMs: this.env.RETRY_DELAY_MS,
    };
  }

  get features() {
    return {
      streaming: this.env.ENABLE_STREAMING,
      toolCalls: this.env.ENABLE_TOOL_CALLS,
    };
  }

  // ============================================================================
  // Agent Configuration Builder
  // ============================================================================

  getAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
    return {
      model: this.env.OPENAI_MODEL,
      maxTokens: 4096,
      temperature: 0.7,
      maxRetries: this.env.MAX_RETRIES,
      retryDelayMs: this.env.RETRY_DELAY_MS,
      enableStreaming: this.env.ENABLE_STREAMING,
      ...overrides,
    };
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const config = Configuration.getInstance();
export type { Env };

