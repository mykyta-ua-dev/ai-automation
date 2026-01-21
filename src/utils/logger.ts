import pino from 'pino';

// ============================================================================
// Logger Configuration
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL ?? 'info';

export const logger = pino({
  level: logLevel,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
  base: {
    service: 'ai-automation-agent',
  },
});

// ============================================================================
// Child Logger Factory (for context-specific logging)
// ============================================================================

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// ============================================================================
// Structured Logging Helpers
// ============================================================================

export function logTaskEvent(
  taskId: string,
  event: string,
  data?: Record<string, unknown>
) {
  logger.info({ taskId, event, ...data }, `Task event: ${event}`);
}

export function logStepEvent(
  taskId: string,
  stepId: string,
  event: string,
  data?: Record<string, unknown>
) {
  logger.info({ taskId, stepId, event, ...data }, `Step event: ${event}`);
}

export function logToolExecution(
  toolName: string,
  params: Record<string, unknown>,
  result: { success: boolean; duration: number }
) {
  const level = result.success ? 'info' : 'warn';
  logger[level](
    { tool: toolName, params, ...result },
    `Tool execution: ${toolName}`
  );
}

export function logLLMCall(
  model: string,
  tokenUsage: { prompt: number; completion: number },
  durationMs: number
) {
  logger.info(
    { model, tokenUsage, durationMs },
    `LLM call completed in ${durationMs}ms`
  );
}
