# AI Automation Agent

A TypeScript-based AI automation framework demonstrating best practices for building AI-powered task automation systems.

## Features

- **AI-Powered Task Planning** - Uses LLMs to break down complex tasks into executable steps
- **Extensible Tool System** - Registry-based tool management with OpenAI function calling support
- **Retry & Circuit Breaker** - Production-grade resilience patterns
- **Structured Logging** - Comprehensive observability with Pino
- **Type Safety** - Full TypeScript with Zod validation
- **Testing** - Vitest test suite included

## Architecture

```
src/
├── agents/           # AI agent implementations
│   ├── base.ts       # Abstract base agent (Template Method pattern)
│   └── automation-agent.ts  # Main automation agent
├── tools/            # Tool system
│   ├── registry.ts   # Centralized tool registry
│   └── builtin/      # Built-in tools
├── services/         # External service integrations
│   └── openai.ts     # OpenAI API wrapper
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
│   ├── logger.ts     # Structured logging
│   ├── retry.ts      # Retry & circuit breaker
│   └── id.ts         # ID generation
├── config/           # Configuration management
└── index.ts          # Entry point
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview

# Application Configuration
LOG_LEVEL=info
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# Feature Flags
ENABLE_STREAMING=true
ENABLE_TOOL_CALLS=true
```

## Usage

### Run Tools Demo (no API key required)

```bash
npm run dev -- --tools
```

### Run AI-Powered Task Demo (requires OpenAI API key)

```bash
npm run dev -- --task
```

### Programmatic Usage

```typescript
import { createAutomationAgent, toolRegistry, builtinTools } from 'ai-automation-agent';

// Register tools
toolRegistry.registerMany(builtinTools);

// Create agent
const agent = createAutomationAgent();

// Subscribe to events
agent.onEvent((event) => {
  console.log(`Event: ${event.type}`, event.data);
});

// Execute a task
const result = await agent.execute({
  description: 'Analyze this text and calculate a date 30 days from now',
  priority: 'high',
  context: {
    text: 'Sample text to analyze...',
  },
});

console.log('Task completed:', result.status);
```

### Creating Custom Tools

```typescript
import { ToolDefinition, ToolResult } from 'ai-automation-agent';

const myCustomTool: ToolDefinition = {
  name: 'my_custom_tool',
  description: 'Does something amazing',
  parameters: [
    {
      name: 'input',
      type: 'string',
      description: 'The input to process',
      required: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    const input = params.input as string;
    
    // Your tool logic here
    const result = input.toUpperCase();
    
    return {
      success: true,
      data: result,
    };
  },
};

// Register the tool
toolRegistry.register(myCustomTool);
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `analyze_text` | Text analysis with word count, frequency analysis |
| `transform_json` | JSON transformation (extract, filter, flatten) |
| `calculate_date` | Date calculations (add, subtract, difference) |
| `validate_data` | Data validation (email, URL, phone, UUID) |
| `http_request` | HTTP requests (simulated in demo mode) |

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Type checking
npm run typecheck
```

## Best Practices Demonstrated

### 1. **Configuration Management**
- Environment-based configuration with Zod validation
- Type-safe access through singleton pattern

### 2. **Error Handling**
- Retry with exponential backoff for transient failures
- Circuit breaker pattern for cascading failure prevention
- Error classification (retryable vs non-retryable)

### 3. **Type Safety**
- Comprehensive TypeScript types
- Runtime validation with Zod schemas
- Strict compiler options

### 4. **Observability**
- Structured JSON logging with Pino
- Event-driven architecture for monitoring
- Execution time tracking

### 5. **AI Integration Patterns**
- Tool registry with OpenAI function calling schema generation
- Streaming support for real-time responses
- JSON mode for structured outputs
- Context-aware parameter resolution

### 6. **Testing**
- Unit tests with Vitest
- Test coverage reporting
- Isolated test cases

## License

MIT

