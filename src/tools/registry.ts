import type { ToolDefinition, ToolResult } from '../types/index.js';
import { logger, logToolExecution } from '../utils/logger.js';

// ============================================================================
// Tool Registry (Centralized Tool Management)
// ============================================================================

class ToolRegistry {
  private static instance: ToolRegistry;
  private tools = new Map<string, ToolDefinition>();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  // ============================================================================
  // Tool Registration
  // ============================================================================

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn({ toolName: tool.name }, 'Overwriting existing tool registration');
    }
    this.tools.set(tool.name, tool);
    logger.info({ toolName: tool.name }, 'Tool registered');
  }

  registerMany(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  unregister(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      logger.info({ toolName: name }, 'Tool unregistered');
    }
    return deleted;
  }

  // ============================================================================
  // Tool Access
  // ============================================================================

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  // ============================================================================
  // Tool Execution with Logging
  // ============================================================================

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    const startTime = Date.now();

    try {
      // Validate required parameters
      const missingParams = tool.parameters
        .filter((p) => p.required && !(p.name in params))
        .map((p) => p.name);

      if (missingParams.length > 0) {
        return {
          success: false,
          error: `Missing required parameters: ${missingParams.join(', ')}`,
        };
      }

      // Apply default values
      const resolvedParams = { ...params };
      for (const param of tool.parameters) {
        if (!(param.name in resolvedParams) && param.default !== undefined) {
          resolvedParams[param.name] = param.default;
        }
      }

      const result = await tool.execute(resolvedParams);
      const duration = Date.now() - startTime;

      logToolExecution(name, params, { success: result.success, duration });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logToolExecution(name, params, { success: false, duration });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTimeMs: duration,
        },
      };
    }
  }

  // ============================================================================
  // OpenAI Function Schema Generation
  // ============================================================================

  toOpenAIFunctions() {
    return this.getAll().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map((p) => [
              p.name,
              {
                type: p.type,
                description: p.description,
              },
            ])
          ),
          required: tool.parameters.filter((p) => p.required).map((p) => p.name),
        },
      },
    }));
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const toolRegistry = ToolRegistry.getInstance();

