export const routes = [
  {
    id: 'embedded',
    product: 'Claude Agent SDK',
    goal: 'Embed an agent in a Python or TypeScript service',
    runner: 'Your application operates the Claude Code runtime',
    interface: 'query() and native agent messages',
    capabilities: 'Built-in tools, sessions, permissions, hooks and MCP',
    documentation: 'https://code.claude.com/docs/en/agent-sdk/overview',
  },
  {
    id: 'terminal',
    product: 'Claude Code CLI',
    goal: 'Work interactively or run a terminal task',
    runner: 'Claude Code invoked from the terminal',
    interface: 'claude or claude -p',
    capabilities: 'Interactive agent workflow and headless execution',
    documentation: 'https://code.claude.com/docs/en/headless',
  },
  {
    id: 'api',
    product: 'Anthropic client SDK',
    goal: 'Send direct model requests from application code',
    runner: 'Your code controls requests and tool handling',
    interface: 'client.messages.create()',
    capabilities: 'Messages API access, streaming and request helpers',
    documentation: 'https://platform.claude.com/docs/en/cli-sdks-libraries/overview',
  },
  {
    id: 'managed',
    product: 'Claude Managed Agents',
    goal: 'Use the hosted agent harness through the API',
    runner: 'Anthropic operates the hosted harness',
    interface: 'Agent, environment, session and event APIs',
    capabilities: 'Hosted agent execution with cloud or self-hosted sandbox choices',
    documentation: 'https://platform.claude.com/docs/en/managed-agents/overview',
  },
];
export function chooseRoute(id: unknown) {
  const route = routes.find((item) => item.id === id);
  if (!route) throw new Error('INVALID_ROUTE · Select a supported classroom use case.');
  return route;
}
export function readAnswer(native: unknown, contract: 'agent-result' | 'client-message') {
  if (!native || typeof native !== 'object')
    throw new Error('RESPONSE_SHAPE_MISMATCH · No native response object.');
  if (contract === 'client-message') {
    if (!('content' in native) || !Array.isArray(native.content))
      throw new Error(
        'RESPONSE_SHAPE_MISMATCH · The client Messages contract requires a content array.',
      );
    return native.content
      .filter(
        (block) =>
          block &&
          typeof block === 'object' &&
          block.type === 'text' &&
          typeof block.text === 'string',
      )
      .map((block) => block.text)
      .join('\n');
  }
  if (
    !('type' in native) ||
    native.type !== 'result' ||
    !('subtype' in native) ||
    native.subtype !== 'success' ||
    !('is_error' in native) ||
    native.is_error ||
    !('result' in native) ||
    typeof native.result !== 'string'
  )
    throw new Error(
      'RESPONSE_SHAPE_MISMATCH · The agent contract requires a successful result message.',
    );
  return native.result;
}
