import type { ToolDefinition, ToolResult } from '../../types/index.js';

// ============================================================================
// Built-in Tools for Common Automation Tasks
// ============================================================================

/**
 * Text Analysis Tool
 * Analyzes text content and returns statistics
 */
export const analyzeTextTool: ToolDefinition = {
  name: 'analyze_text',
  description: 'Analyzes text content and returns word count, character count, and basic statistics',
  parameters: [
    {
      name: 'text',
      type: 'string',
      description: 'The text content to analyze',
      required: true,
    },
    {
      name: 'includeWordFrequency',
      type: 'boolean',
      description: 'Whether to include word frequency analysis',
      required: false,
      default: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const text = params.text as string;
    const includeWordFrequency = params.includeWordFrequency as boolean;

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

    const result: Record<string, unknown> = {
      characterCount: text.length,
      characterCountNoSpaces: text.replace(/\s/g, '').length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      averageWordLength: words.length > 0 ? words.reduce((sum, w) => sum + w.length, 0) / words.length : 0,
      averageSentenceLength: sentences.length > 0 ? words.length / sentences.length : 0,
    };

    if (includeWordFrequency) {
      const frequency: Record<string, number> = {};
      for (const word of words.map((w) => w.toLowerCase().replace(/[^\w]/g, ''))) {
        if (word) {
          frequency[word] = (frequency[word] ?? 0) + 1;
        }
      }
      const sorted = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      result.topWords = Object.fromEntries(sorted);
    }

    return {
      success: true,
      data: result,
    };
  },
};

/**
 * JSON Transformer Tool
 * Transforms JSON data according to specified operations
 */
export const transformJsonTool: ToolDefinition = {
  name: 'transform_json',
  description: 'Transforms JSON data by extracting, filtering, or mapping fields',
  parameters: [
    {
      name: 'data',
      type: 'object',
      description: 'The JSON data to transform',
      required: true,
    },
    {
      name: 'operation',
      type: 'string',
      description: 'Operation type: extract, filter, map, flatten',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: 'JSON path for extraction (dot notation)',
      required: false,
    },
    {
      name: 'fields',
      type: 'array',
      description: 'Fields to include in the result',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const data = params.data as Record<string, unknown> | unknown[];
    const operation = params.operation as string;
    const path = params.path as string | undefined;
    const fields = params.fields as string[] | undefined;

    try {
      let result: unknown;

      switch (operation) {
        case 'extract': {
          if (!path) {
            return { success: false, error: 'Path is required for extract operation' };
          }
          result = getNestedValue(data, path);
          break;
        }
        case 'filter': {
          if (!Array.isArray(data)) {
            return { success: false, error: 'Data must be an array for filter operation' };
          }
          if (!fields || fields.length === 0) {
            return { success: false, error: 'Fields are required for filter operation' };
          }
          result = data.map((item) => {
            if (typeof item !== 'object' || item === null) return item;
            const filtered: Record<string, unknown> = {};
            for (const field of fields) {
              if (field in item) {
                filtered[field] = (item as Record<string, unknown>)[field];
              }
            }
            return filtered;
          });
          break;
        }
        case 'flatten': {
          result = flattenObject(data as Record<string, unknown>);
          break;
        }
        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transform failed',
      };
    }
  },
};

/**
 * Date/Time Calculator Tool
 */
export const dateCalculatorTool: ToolDefinition = {
  name: 'calculate_date',
  description: 'Performs date calculations like adding/subtracting days, formatting, or finding differences',
  parameters: [
    {
      name: 'operation',
      type: 'string',
      description: 'Operation: add, subtract, difference, format, now',
      required: true,
    },
    {
      name: 'date',
      type: 'string',
      description: 'Base date in ISO format (optional for "now" operation)',
      required: false,
    },
    {
      name: 'amount',
      type: 'number',
      description: 'Amount to add/subtract',
      required: false,
    },
    {
      name: 'unit',
      type: 'string',
      description: 'Unit: days, hours, minutes, seconds',
      required: false,
      default: 'days',
    },
    {
      name: 'endDate',
      type: 'string',
      description: 'End date for difference calculation',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const operation = params.operation as string;
    const dateStr = params.date as string | undefined;
    const amount = params.amount as number | undefined;
    const unit = (params.unit as string) || 'days';
    const endDateStr = params.endDate as string | undefined;

    const baseDate = dateStr ? new Date(dateStr) : new Date();

    if (isNaN(baseDate.getTime())) {
      return { success: false, error: 'Invalid date format' };
    }

    const getMultiplier = (u: string): number => {
      switch (u) {
        case 'seconds':
          return 1000;
        case 'minutes':
          return 60 * 1000;
        case 'hours':
          return 60 * 60 * 1000;
        case 'days':
          return 24 * 60 * 60 * 1000;
        default:
          return 24 * 60 * 60 * 1000;
      }
    };

    switch (operation) {
      case 'now':
        return {
          success: true,
          data: {
            iso: new Date().toISOString(),
            unix: Date.now(),
            formatted: new Date().toLocaleString(),
          },
        };
      case 'add':
      case 'subtract': {
        if (amount === undefined) {
          return { success: false, error: 'Amount is required for add/subtract' };
        }
        const multiplier = operation === 'add' ? 1 : -1;
        const newDate = new Date(baseDate.getTime() + multiplier * amount * getMultiplier(unit));
        return {
          success: true,
          data: {
            original: baseDate.toISOString(),
            result: newDate.toISOString(),
            operation,
            amount,
            unit,
          },
        };
      }
      case 'difference': {
        if (!endDateStr) {
          return { success: false, error: 'End date is required for difference' };
        }
        const endDate = new Date(endDateStr);
        if (isNaN(endDate.getTime())) {
          return { success: false, error: 'Invalid end date format' };
        }
        const diffMs = endDate.getTime() - baseDate.getTime();
        return {
          success: true,
          data: {
            startDate: baseDate.toISOString(),
            endDate: endDate.toISOString(),
            difference: {
              milliseconds: diffMs,
              seconds: Math.floor(diffMs / 1000),
              minutes: Math.floor(diffMs / (60 * 1000)),
              hours: Math.floor(diffMs / (60 * 60 * 1000)),
              days: Math.floor(diffMs / (24 * 60 * 60 * 1000)),
            },
          },
        };
      }
      case 'format':
        return {
          success: true,
          data: {
            iso: baseDate.toISOString(),
            utc: baseDate.toUTCString(),
            local: baseDate.toLocaleString(),
            date: baseDate.toLocaleDateString(),
            time: baseDate.toLocaleTimeString(),
          },
        };
      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
  },
};

/**
 * HTTP Request Tool (simulated for demo)
 */
export const httpRequestTool: ToolDefinition = {
  name: 'http_request',
  description: 'Makes HTTP requests to external APIs (simulated in demo mode)',
  parameters: [
    {
      name: 'method',
      type: 'string',
      description: 'HTTP method: GET, POST, PUT, DELETE',
      required: true,
    },
    {
      name: 'url',
      type: 'string',
      description: 'The URL to request',
      required: true,
    },
    {
      name: 'headers',
      type: 'object',
      description: 'Request headers',
      required: false,
    },
    {
      name: 'body',
      type: 'object',
      description: 'Request body for POST/PUT',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    // Simulated HTTP request for demo purposes
    const method = params.method as string;
    const url = params.url as string;

    // In a real implementation, you would use fetch() here
    return {
      success: true,
      data: {
        simulated: true,
        request: {
          method,
          url,
          headers: params.headers,
          body: params.body,
        },
        response: {
          status: 200,
          message: 'This is a simulated response for demo purposes',
        },
      },
    };
  },
};

/**
 * Data Validation Tool
 */
export const validateDataTool: ToolDefinition = {
  name: 'validate_data',
  description: 'Validates data against common patterns (email, URL, phone, etc.)',
  parameters: [
    {
      name: 'value',
      type: 'string',
      description: 'The value to validate',
      required: true,
    },
    {
      name: 'type',
      type: 'string',
      description: 'Validation type: email, url, phone, uuid, date, number',
      required: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const value = params.value as string;
    const type = params.type as string;

    const patterns: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
      phone: /^\+?[\d\s-()]{10,}$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      date: /^\d{4}-\d{2}-\d{2}$/,
      number: /^-?\d+(\.\d+)?$/,
    };

    const pattern = patterns[type];
    if (!pattern) {
      return {
        success: false,
        error: `Unknown validation type: ${type}. Available: ${Object.keys(patterns).join(', ')}`,
      };
    }

    const isValid = pattern.test(value);

    return {
      success: true,
      data: {
        value,
        type,
        isValid,
        pattern: pattern.source,
      },
    };
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// ============================================================================
// Export All Built-in Tools
// ============================================================================

export const builtinTools: ToolDefinition[] = [
  analyzeTextTool,
  transformJsonTool,
  dateCalculatorTool,
  httpRequestTool,
  validateDataTool,
];

