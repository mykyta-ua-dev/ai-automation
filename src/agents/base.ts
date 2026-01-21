import type {
  Task,
  TaskInput,
  TaskStep,
  TaskStatus,
  AgentEvent,
  EventHandler,
  ExecutionContext,
  ToolResult,
} from '../types/index.js';
import { TaskInputSchema } from '../types/index.js';
import { generateId } from '../utils/id.js';
import { logger, logTaskEvent, logStepEvent } from '../utils/logger.js';
import { toolRegistry } from '../tools/registry.js';

// ============================================================================
// Abstract Base Agent (Template Method Pattern)
// ============================================================================

export abstract class BaseAgent {
  protected eventHandlers: EventHandler[] = [];

  // ============================================================================
  // Event Handling
  // ============================================================================

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  protected async emitEvent(event: Omit<AgentEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AgentEvent = {
      ...event,
      timestamp: new Date(),
    };

    for (const handler of this.eventHandlers) {
      try {
        await handler(fullEvent);
      } catch (error) {
        logger.error({ error, event: fullEvent }, 'Event handler error');
      }
    }
  }

  // ============================================================================
  // Task Execution (Template Method)
  // ============================================================================

  async execute(input: TaskInput): Promise<Task> {
    // Validate input
    const validatedInput = TaskInputSchema.parse(input);

    // Create task
    const task: Task = {
      id: generateId('task'),
      input: validatedInput,
      status: 'pending',
      steps: [],
      createdAt: new Date(),
      metadata: {},
    };

    await this.emitEvent({ type: 'task:created', taskId: task.id, data: { input: validatedInput } });
    logTaskEvent(task.id, 'created', { description: validatedInput.description });

    try {
      // Start task
      task.status = 'planning';
      task.startedAt = new Date();
      await this.emitEvent({ type: 'task:started', taskId: task.id, data: {} });

      // Planning phase
      await this.emitEvent({ type: 'task:planning', taskId: task.id, data: {} });
      const steps = await this.plan(task);
      task.steps = steps;
      await this.emitEvent({ type: 'task:planned', taskId: task.id, data: { stepCount: steps.length } });
      logTaskEvent(task.id, 'planned', { stepCount: steps.length });

      // Execution phase
      task.status = 'executing';
      const context: ExecutionContext = {
        taskId: task.id,
        stepResults: new Map(),
        variables: new Map(),
      };

      for (const step of task.steps) {
        if (task.status !== 'executing') break;

        await this.executeStep(step, context);

        if (step.status === 'failed') {
          task.status = 'failed';
          task.error = step.error;
          break;
        }
      }

      // Complete task
      if (task.status === 'executing') {
        task.status = 'completed';
        task.result = this.aggregateResults(task.steps);
        await this.emitEvent({
          type: 'task:completed',
          taskId: task.id,
          data: { result: task.result },
        });
        logTaskEvent(task.id, 'completed');
      } else {
        await this.emitEvent({
          type: 'task:failed',
          taskId: task.id,
          data: { error: task.error },
        });
        logTaskEvent(task.id, 'failed', { error: task.error });
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      await this.emitEvent({
        type: 'task:failed',
        taskId: task.id,
        data: { error: task.error },
      });
      logTaskEvent(task.id, 'failed', { error: task.error });
    }

    task.completedAt = new Date();
    return task;
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

  protected abstract plan(task: Task): Promise<TaskStep[]>;

  // ============================================================================
  // Step Execution
  // ============================================================================

  protected async executeStep(step: TaskStep, context: ExecutionContext): Promise<void> {
    step.status = 'executing';
    step.startedAt = new Date();

    await this.emitEvent({
      type: 'step:started',
      taskId: context.taskId,
      data: { stepId: step.id, toolName: step.toolName },
    });
    logStepEvent(context.taskId, step.id, 'started', { toolName: step.toolName });

    try {
      // Resolve parameters with context variables
      const resolvedParams = this.resolveParameters(step.parameters, context);

      // Execute tool
      const result = await toolRegistry.execute(step.toolName, resolvedParams);

      if (result.success) {
        step.status = 'completed';
        step.result = result.data;
        context.stepResults.set(step.id, result);

        // Store result in variables for subsequent steps
        if (result.data !== undefined) {
          context.variables.set(`step.${step.id}.result`, result.data);
        }

        await this.emitEvent({
          type: 'step:completed',
          taskId: context.taskId,
          data: { stepId: step.id, result: result.data },
        });
        logStepEvent(context.taskId, step.id, 'completed');
      } else {
        step.status = 'failed';
        step.error = result.error;

        await this.emitEvent({
          type: 'step:failed',
          taskId: context.taskId,
          data: { stepId: step.id, error: result.error },
        });
        logStepEvent(context.taskId, step.id, 'failed', { error: result.error });
      }
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';

      await this.emitEvent({
        type: 'step:failed',
        taskId: context.taskId,
        data: { stepId: step.id, error: step.error },
      });
      logStepEvent(context.taskId, step.id, 'failed', { error: step.error });
    }

    step.completedAt = new Date();
  }

  // ============================================================================
  // Parameter Resolution
  // ============================================================================

  protected resolveParameters(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Variable reference (e.g., "$step.step_xyz.result")
        const varPath = value.slice(1);
        resolved[key] = context.variables.get(varPath) ?? value;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveParameters(value as Record<string, unknown>, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  // ============================================================================
  // Result Aggregation
  // ============================================================================

  protected aggregateResults(steps: TaskStep[]): unknown {
    const results: Record<string, unknown> = {};

    for (const step of steps) {
      if (step.status === 'completed' && step.result !== undefined) {
        results[step.id] = {
          name: step.name,
          result: step.result,
        };
      }
    }

    return results;
  }

  // ============================================================================
  // Task Control
  // ============================================================================

  updateTaskStatus(task: Task, status: TaskStatus): void {
    task.status = status;
    logTaskEvent(task.id, 'status_changed', { status });
  }
}

