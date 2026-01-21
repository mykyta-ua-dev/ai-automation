import { z } from 'zod';

// ============================================================================
// Core Domain Types
// ============================================================================

export const TaskStatusSchema = z.enum([
  'pending',
  'planning',
  'executing',
  'completed',
  'failed',
  'cancelled',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

// ============================================================================
// Task Definitions
// ============================================================================

export const TaskInputSchema = z.object({
  description: z.string().min(1, 'Task description is required'),
  priority: TaskPrioritySchema.default('medium'),
  context: z.record(z.unknown()).optional(),
  maxSteps: z.number().int().positive().default(10),
  timeoutMs: z.number().int().positive().default(60000),
});

export type TaskInput = z.infer<typeof TaskInputSchema>;

export interface TaskStep {
  id: string;
  name: string;
  description: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Task {
  id: string;
  input: TaskInput;
  status: TaskStatus;
  steps: TaskStep[];
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  retryDelayMs: number;
  enableStreaming: boolean;
}

export interface PlanningResult {
  steps: Array<{
    name: string;
    description: string;
    toolName: string;
    parameters: Record<string, unknown>;
  }>;
  reasoning: string;
}

export interface ExecutionContext {
  taskId: string;
  stepResults: Map<string, ToolResult>;
  variables: Map<string, unknown>;
}

// ============================================================================
// Message Types (for LLM communication)
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

// ============================================================================
// Event Types (for observability)
// ============================================================================

export type EventType =
  | 'task:created'
  | 'task:started'
  | 'task:planning'
  | 'task:planned'
  | 'step:started'
  | 'step:completed'
  | 'step:failed'
  | 'task:completed'
  | 'task:failed';

export interface AgentEvent {
  type: EventType;
  taskId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type EventHandler = (event: AgentEvent) => void | Promise<void>;

