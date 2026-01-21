import type { Task, TaskStep, PlanningResult, Message } from '../types/index.js';
import { BaseAgent } from './base.js';
import { getOpenAIService, OpenAIService } from '../services/openai.js';
import { toolRegistry } from '../tools/registry.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Automation Agent (AI-Powered Task Planner & Executor)
// ============================================================================

export class AutomationAgent extends BaseAgent {
  private openai: OpenAIService;

  constructor() {
    super();
    this.openai = getOpenAIService();
  }

  // ============================================================================
  // Planning Phase (LLM-Powered)
  // ============================================================================

  protected async plan(task: Task): Promise<TaskStep[]> {
    const availableTools = toolRegistry.getAll();

    if (availableTools.length === 0) {
      logger.warn('No tools registered, using simple plan');
      return this.createSimplePlan(task);
    }

    try {
      const planningResult = await this.createAIPlan(task, availableTools);
      return this.convertPlanToSteps(planningResult);
    } catch (error) {
      logger.error({ error }, 'AI planning failed, falling back to simple plan');
      return this.createSimplePlan(task);
    }
  }

  // ============================================================================
  // AI-Powered Planning
  // ============================================================================

  private async createAIPlan(
    task: Task,
    availableTools: Array<{ name: string; description: string; parameters: unknown[] }>
  ): Promise<PlanningResult> {
    const toolDescriptions = availableTools
      .map(
        (t) =>
          `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters, null, 2)}`
      )
      .join('\n\n');

    const systemPrompt = `You are an AI task planner. Your job is to break down user tasks into executable steps using available tools.

Available Tools:
${toolDescriptions}

Rules:
1. Only use the tools that are available
2. Create a logical sequence of steps
3. Each step must use exactly one tool
4. Parameters should be valid JSON values
5. Use "$step.<stepId>.result" to reference previous step results

Respond with a JSON object containing:
- "reasoning": brief explanation of your plan
- "steps": array of step objects with "name", "description", "toolName", "parameters"`;

    const userPrompt = `Task: ${task.input.description}

Priority: ${task.input.priority}
Max Steps: ${task.input.maxSteps}

Additional Context: ${JSON.stringify(task.input.context ?? {})}

Create a plan to accomplish this task.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return await this.openai.completeJson<PlanningResult>(messages);
  }

  // ============================================================================
  // Plan Conversion
  // ============================================================================

  private convertPlanToSteps(plan: PlanningResult): TaskStep[] {
    return plan.steps.map((step, index) => ({
      id: generateId('step'),
      name: step.name || `Step ${index + 1}`,
      description: step.description,
      toolName: step.toolName,
      parameters: step.parameters,
      status: 'pending',
    }));
  }

  // ============================================================================
  // Fallback Simple Planning
  // ============================================================================

  private createSimplePlan(task: Task): TaskStep[] {
    // Extract potential tool usage from task description
    const toolNames = toolRegistry.getNames();
    const matchedTool = toolNames.find((name) =>
      task.input.description.toLowerCase().includes(name.replace(/_/g, ' '))
    );

    if (matchedTool) {
      return [
        {
          id: generateId('step'),
          name: `Execute ${matchedTool}`,
          description: task.input.description,
          toolName: matchedTool,
          parameters: task.input.context ?? {},
          status: 'pending',
        },
      ];
    }

    // Default: analyze text if no specific tool matched
    return [
      {
        id: generateId('step'),
        name: 'Analyze Input',
        description: 'Analyze the task input for insights',
        toolName: 'analyze_text',
        parameters: { text: task.input.description },
        status: 'pending',
      },
    ];
  }

  // ============================================================================
  // Interactive Mode (Tool Calling Loop)
  // ============================================================================

  async runInteractive(userMessage: string): Promise<string> {
    const tools = toolRegistry.toOpenAIFunctions();

    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an AI assistant that can use tools to help users. 
When you need to perform an action, use the appropriate tool.
Always explain what you're doing and provide helpful responses.`,
      },
      { role: 'user', content: userMessage },
    ];

    let response = await this.openai.complete(messages, {
      tools,
      toolChoice: 'auto',
    });

    // Tool calling loop
    while (response.choices[0]?.message?.tool_calls) {
      const assistantMessage = response.choices[0].message;
      messages.push({
        role: 'assistant',
        content: assistantMessage.content ?? '',
      });

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const params = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

        logger.info({ toolName, params }, 'Executing tool call');

        const result = await toolRegistry.execute(toolName, params);

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }

      // Get next response
      response = await this.openai.complete(messages, {
        tools,
        toolChoice: 'auto',
      });
    }

    return response.choices[0]?.message?.content ?? 'No response generated';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAutomationAgent(): AutomationAgent {
  return new AutomationAgent();
}

