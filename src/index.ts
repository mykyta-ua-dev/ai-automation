import { toolRegistry } from './tools/registry.js';
import { builtinTools } from './tools/builtin/index.js';
import { createAutomationAgent } from './agents/automation-agent.js';
import { logger } from './utils/logger.js';
import type { Task, TaskInput } from './types/index.js';

// ============================================================================
// Initialize Application
// ============================================================================

function initialize(): void {
  logger.info('Initializing AI Automation Agent...');

  // Register built-in tools
  toolRegistry.registerMany(builtinTools);
  logger.info({ tools: toolRegistry.getNames() }, 'Tools registered');
}

// ============================================================================
// Demo Functions
// ============================================================================

async function runTaskDemo(): Promise<void> {
  logger.info('='.repeat(60));
  logger.info('Running Task Automation Demo');
  logger.info('='.repeat(60));

  const agent = createAutomationAgent();

  // Subscribe to events for observability
  agent.onEvent((event) => {
    logger.debug({ event }, 'Agent event');
  });

  // Example task: Analyze and process text
  const taskInput: TaskInput = {
    description: 'Analyze this sample text and calculate when 30 days from now is',
    priority: 'medium',
    context: {
      sampleText:
        'Artificial intelligence is transforming how we work and live. Machine learning enables computers to learn from data without being explicitly programmed.',
    },
    maxSteps: 5,
    timeoutMs: 30000,
  };

  try {
    logger.info({ description: taskInput.description }, 'Starting task');
    const result = await agent.execute(taskInput);
    logTaskResult(result);
  } catch (error) {
    logger.error({ error }, 'Task execution failed');
  }
}

async function runToolDemo(): Promise<void> {
  logger.info('='.repeat(60));
  logger.info('Running Built-in Tools Demo');
  logger.info('='.repeat(60));

  // Demo 1: Text Analysis
  logger.info('--- Text Analysis ---');
  const textResult = await toolRegistry.execute('analyze_text', {
    text: 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.',
    includeWordFrequency: true,
  });
  logger.info({ result: textResult.data }, 'Text analysis complete');

  // Demo 2: Date Calculation
  logger.info('--- Date Calculation ---');
  const dateResult = await toolRegistry.execute('calculate_date', {
    operation: 'add',
    amount: 30,
    unit: 'days',
  });
  logger.info({ result: dateResult.data }, 'Date calculation complete');

  // Demo 3: Data Validation
  logger.info('--- Data Validation ---');
  const emailResult = await toolRegistry.execute('validate_data', {
    value: 'test@example.com',
    type: 'email',
  });
  logger.info({ result: emailResult.data }, 'Email validation complete');

  // Demo 4: JSON Transformation
  logger.info('--- JSON Transformation ---');
  const jsonResult = await toolRegistry.execute('transform_json', {
    data: {
      user: {
        name: 'John',
        address: {
          city: 'New York',
          country: 'USA',
        },
      },
    },
    operation: 'flatten',
  });
  logger.info({ result: jsonResult.data }, 'JSON transformation complete');
}

function logTaskResult(task: Task): void {
  logger.info('='.repeat(60));
  logger.info('Task Execution Result');
  logger.info('='.repeat(60));
  logger.info({
    taskId: task.id,
    status: task.status,
    stepsExecuted: task.steps.length,
    completedSteps: task.steps.filter((s) => s.status === 'completed').length,
    failedSteps: task.steps.filter((s) => s.status === 'failed').length,
    duration: task.completedAt && task.startedAt
      ? `${task.completedAt.getTime() - task.startedAt.getTime()}ms`
      : 'N/A',
  }, 'Task summary');

  if (task.status === 'completed') {
    logger.info({ result: task.result }, 'Task result');
  } else if (task.error) {
    logger.error({ error: task.error }, 'Task error');
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  try {
    initialize();

    // Check if running with --demo flag
    const args = process.argv.slice(2);

    if (args.includes('--tools')) {
      await runToolDemo();
    } else if (args.includes('--task')) {
      await runTaskDemo();
    } else {
      // Default: run tools demo (doesn't require API key)
      logger.info('Running tools demo (use --task for AI-powered task demo)');
      await runToolDemo();
    }

    logger.info('Demo completed successfully');
  } catch (error) {
    logger.error({ error }, 'Application error');
    process.exit(1);
  }
}

// Run the application
main();

// ============================================================================
// Exports for Library Usage
// ============================================================================

export { createAutomationAgent } from './agents/automation-agent.js';
export { toolRegistry } from './tools/registry.js';
export { builtinTools } from './tools/builtin/index.js';
export * from './types/index.js';
export { config } from './config/index.js';
export { logger, createChildLogger } from './utils/logger.js';

