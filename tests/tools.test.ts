import { describe, it, expect, beforeEach } from 'vitest';
import { toolRegistry } from '../src/tools/registry.js';
import { builtinTools } from '../src/tools/builtin/index.js';

// ============================================================================
// Tool Registry Tests
// ============================================================================

describe('Tool Registry', () => {
  beforeEach(() => {
    // Register built-in tools before each test
    toolRegistry.registerMany(builtinTools);
  });

  it('should register tools', () => {
    expect(toolRegistry.has('analyze_text')).toBe(true);
    expect(toolRegistry.has('transform_json')).toBe(true);
    expect(toolRegistry.has('calculate_date')).toBe(true);
  });

  it('should list all registered tools', () => {
    const names = toolRegistry.getNames();
    expect(names).toContain('analyze_text');
    expect(names).toContain('transform_json');
    expect(names).toContain('calculate_date');
    expect(names).toContain('http_request');
    expect(names).toContain('validate_data');
  });

  it('should return undefined for unregistered tools', () => {
    expect(toolRegistry.get('non_existent_tool')).toBeUndefined();
  });
});

// ============================================================================
// Text Analysis Tool Tests
// ============================================================================

describe('analyze_text Tool', () => {
  beforeEach(() => {
    toolRegistry.registerMany(builtinTools);
  });

  it('should analyze text and return statistics', async () => {
    const result = await toolRegistry.execute('analyze_text', {
      text: 'Hello world. This is a test.',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      wordCount: 6,
      sentenceCount: 2,
    });
  });

  it('should include word frequency when requested', async () => {
    const result = await toolRegistry.execute('analyze_text', {
      text: 'hello hello world',
      includeWordFrequency: true,
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.topWords).toBeDefined();
    const topWords = data.topWords as Record<string, number>;
    expect(topWords.hello).toBe(2);
    expect(topWords.world).toBe(1);
  });

  it('should handle empty text', async () => {
    const result = await toolRegistry.execute('analyze_text', {
      text: '',
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.wordCount).toBe(0);
  });
});

// ============================================================================
// Date Calculator Tool Tests
// ============================================================================

describe('calculate_date Tool', () => {
  beforeEach(() => {
    toolRegistry.registerMany(builtinTools);
  });

  it('should return current date/time with now operation', async () => {
    const result = await toolRegistry.execute('calculate_date', {
      operation: 'now',
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.iso).toBeDefined();
    expect(data.unix).toBeDefined();
  });

  it('should add days to a date', async () => {
    const result = await toolRegistry.execute('calculate_date', {
      operation: 'add',
      date: '2024-01-01T00:00:00Z',
      amount: 10,
      unit: 'days',
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.result).toContain('2024-01-11');
  });

  it('should calculate difference between dates', async () => {
    const result = await toolRegistry.execute('calculate_date', {
      operation: 'difference',
      date: '2024-01-01T00:00:00Z',
      endDate: '2024-01-15T00:00:00Z',
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const diff = data.difference as Record<string, number>;
    expect(diff.days).toBe(14);
  });

  it('should handle invalid dates', async () => {
    const result = await toolRegistry.execute('calculate_date', {
      operation: 'add',
      date: 'invalid-date',
      amount: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid date');
  });
});

// ============================================================================
// Data Validation Tool Tests
// ============================================================================

describe('validate_data Tool', () => {
  beforeEach(() => {
    toolRegistry.registerMany(builtinTools);
  });

  it('should validate email addresses', async () => {
    const validResult = await toolRegistry.execute('validate_data', {
      value: 'test@example.com',
      type: 'email',
    });

    expect(validResult.success).toBe(true);
    expect((validResult.data as Record<string, unknown>).isValid).toBe(true);

    const invalidResult = await toolRegistry.execute('validate_data', {
      value: 'not-an-email',
      type: 'email',
    });

    expect(invalidResult.success).toBe(true);
    expect((invalidResult.data as Record<string, unknown>).isValid).toBe(false);
  });

  it('should validate URLs', async () => {
    const validResult = await toolRegistry.execute('validate_data', {
      value: 'https://example.com/path',
      type: 'url',
    });

    expect(validResult.success).toBe(true);
    expect((validResult.data as Record<string, unknown>).isValid).toBe(true);
  });

  it('should validate UUIDs', async () => {
    const validResult = await toolRegistry.execute('validate_data', {
      value: '550e8400-e29b-41d4-a716-446655440000',
      type: 'uuid',
    });

    expect(validResult.success).toBe(true);
    expect((validResult.data as Record<string, unknown>).isValid).toBe(true);
  });

  it('should handle unknown validation types', async () => {
    const result = await toolRegistry.execute('validate_data', {
      value: 'test',
      type: 'unknown_type',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown validation type');
  });
});

// ============================================================================
// JSON Transform Tool Tests
// ============================================================================

describe('transform_json Tool', () => {
  beforeEach(() => {
    toolRegistry.registerMany(builtinTools);
  });

  it('should extract nested values', async () => {
    const result = await toolRegistry.execute('transform_json', {
      data: { user: { name: 'John', age: 30 } },
      operation: 'extract',
      path: 'user.name',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe('John');
  });

  it('should flatten nested objects', async () => {
    const result = await toolRegistry.execute('transform_json', {
      data: {
        user: {
          name: 'John',
          address: { city: 'NYC' },
        },
      },
      operation: 'flatten',
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data['user.name']).toBe('John');
    expect(data['user.address.city']).toBe('NYC');
  });

  it('should filter array fields', async () => {
    const result = await toolRegistry.execute('transform_json', {
      data: [
        { id: 1, name: 'John', secret: 'hidden' },
        { id: 2, name: 'Jane', secret: 'hidden' },
      ],
      operation: 'filter',
      fields: ['id', 'name'],
    });

    expect(result.success).toBe(true);
    const data = result.data as Array<Record<string, unknown>>;
    expect(data[0]).toEqual({ id: 1, name: 'John' });
    expect(data[0]).not.toHaveProperty('secret');
  });
});

