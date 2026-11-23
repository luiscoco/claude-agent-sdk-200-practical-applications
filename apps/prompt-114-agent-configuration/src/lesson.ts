import { createSdkMcpServer, tool, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { skill } from './extensions.js';
import { fixture, agentOptions, agentCalls, answer } from './agents.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  await fixture();
  await skill('queue-audit', 'Use record IDs when reporting queue safeguards.');
  const definitions: Record<string, AgentDefinition> = {
    configured: { description: 'Audit queue safeguards using the classroom policy tool and the queue-audit skill.',
      prompt: 'Audit queue-design.txt. Call the classroom policy tool. Use record IDs and identify missing safeguards. Do not write files.',
      model: 'inherit', tools: ['Read', 'mcp__classroom__policy'], skills: ['queue-audit'], memory: 'local',
      mcpServers: ['classroom'], permissionMode: 'default', maxTurns: 4 },
  };
  let policyCalls = 0;
  const server = createSdkMcpServer({ name: 'classroom', version: '1.0.0', tools: [
    tool('policy', 'Return the classroom queue safety policy.', { topic: z.string() }, async () => {
      policyCalls++; return { content: [{ type: 'text', text: 'POLICY: require idempotency keys and bounded retries.' }] };
    }),
  ] });
  const options = { ...agentOptions(definitions), settingSources: ['project'] as ('project')[],
    mcpServers: { classroom: server }, allowedTools: ['mcp__classroom__policy'] };
  const discovery = await inspect(options);
  const live = mode === 'live' ? await native('Use configured to audit queue-design.txt. Its report must use the classroom policy tool and cite Q2/Q3.', options, true) : null;
  if (live) requireNative(live, false);
  const ownedText = await readFile(path.join(process.env.LAB_WORKSPACE!, 'queue-design.txt'), 'utf8');
  return report({ definitions, discovered: discovery.agents, declaredInheritance: { model: 'inherit',
    tools: 'explicit allowlist', skills: 'explicit preload', memory: 'project-local', mcp: 'named server' },
    policyCalls, answer: live ? answer(live.events) : null }, {
    configuredAgentActuallyDiscovered: hasName(discovery.agents, 'configured'),
    ownedDocumentUnchanged: ownedText.includes('Q2: No idempotency key is stored.'),
    ...(live ? { actualConfiguredSpecialistInvoked: agentCalls(live.events).some(b => b.input.subagent_type === 'configured'),
      specialistActuallyUsesPolicyTool: policyCalls > 0, answerReflectsPolicy: /idempotenc/i.test(answer(live.events)) } : {}),
  }, { discovery, live }, 'Configuration declares the documented model, tools, skill, memory scope, MCP server and permissions. Local discovery does not prove every inheritance setting took effect. Live evidence requires an actual specialist and MCP callback.');
}
