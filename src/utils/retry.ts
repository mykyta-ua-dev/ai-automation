import pRetry, { AbortError } from 'p-retry';
import { logger } from './logger.js';

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryOptions {
  retries: number;
  minTimeout: number;
  maxTimeout?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

// ============================================================================
// Error Classification
// ============================================================================

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AbortError) {
    return false;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
      return true;
    }

    // Rate limiting (429)
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true;
    }

    // Server errors (5xx)
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return true;
    }

    // OpenAI specific errors
    if (error.message.includes('overloaded') || error.message.includes('capacity')) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Retry Wrapper with Exponential Backoff
// ============================================================================

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  return pRetry(
    async () => {
      try {
        return await operation();
      } catch (error) {
        if (!isRetryableError(error)) {
          throw new AbortError(error instanceof Error ? error.message : 'Non-retryable error');
        }
        throw error;
      }
    },
    {
      retries: options.retries,
      minTimeout: options.minTimeout,
      maxTimeout: options.maxTimeout ?? options.minTimeout * 10,
      factor: options.factor ?? 2,
      onFailedAttempt: (error) => {
        logger.warn(
          {
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            error: error.message,
          },
          `Retry attempt ${error.attemptNumber} failed`
        );
        options.onRetry?.(error, error.attemptNumber);
      },
    }
  );
}

// ============================================================================
// Circuit Breaker Pattern
// ============================================================================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime?: Date;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.options.resetTimeoutMs;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      logger.warn({ failures: this.failures }, 'Circuit breaker opened');
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

