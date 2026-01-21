import { nanoid } from 'nanoid';

// ============================================================================
// ID Generation Utilities
// ============================================================================

const PREFIXES = {
  task: 'task',
  step: 'step',
  tool: 'tool',
  event: 'evt',
} as const;

type IdPrefix = keyof typeof PREFIXES;

/**
 * Generates a unique ID with a type-specific prefix
 * Format: {prefix}_{nanoid}
 * Example: task_abc123xyz
 */
export function generateId(prefix: IdPrefix): string {
  return `${PREFIXES[prefix]}_${nanoid(12)}`;
}

/**
 * Validates that an ID matches the expected format
 */
export function isValidId(id: string, prefix?: IdPrefix): boolean {
  if (prefix) {
    return id.startsWith(`${PREFIXES[prefix]}_`);
  }
  return Object.values(PREFIXES).some((p) => id.startsWith(`${p}_`));
}

/**
 * Extracts the prefix from an ID
 */
export function getIdPrefix(id: string): IdPrefix | null {
  for (const [key, value] of Object.entries(PREFIXES)) {
    if (id.startsWith(`${value}_`)) {
      return key as IdPrefix;
    }
  }
  return null;
}

