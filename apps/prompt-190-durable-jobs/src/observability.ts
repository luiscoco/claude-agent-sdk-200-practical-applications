import { createServer } from 'node:http';
export function eventLog(requestId: string, events: any[]) {
  return events.map((event, sequence) => ({ requestId, sequence, type: event.type,
    subtype: event.subtype ?? null, sessionId: event.session_id ?? null, uuid: event.uuid ?? null,
    parentToolUseId: event.parent_tool_use_id ?? null, agentId: event.agent_id ?? null,
    toolCalls: event.type === 'assistant' ? (event.message?.content ?? []).filter((b: any) => b.type === 'tool_use').map((b: any) => ({ id: b.id, name: b.name })) : [],
    toolResults: event.type === 'user' ? (Array.isArray(event.message?.content) ? event.message.content : []).filter((b: any) => b.type === 'tool_result').map((b: any) => ({ toolUseId: b.tool_use_id, isError: Boolean(b.is_error) })) : [],
  }));
}
export async function collector(status = 200) {
  const requests: Array<{ path: string; bytes: number; contentType: string | undefined; body: unknown }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 4000000) { response.writeHead(413).end(); return; } chunks.push(chunk); }
    const text = Buffer.concat(chunks).toString('utf8'); let body: unknown = null;
    try { body = JSON.parse(text); } catch { body = { encoding: 'non-JSON', byteLength: size }; }
    requests.push({ path: request.url || '/', bytes: size, contentType: request.headers['content-type'], body });
    response.writeHead(status, { 'Content-Type': 'application/json' }).end(status === 200 ? '{}' : '{"error":"Owned collector failure"}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Collector did not bind.');
  return { requests, endpoint: 'http://127.0.0.1:' + address.port,
    close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
export function telemetryEnv(endpoint: string): NodeJS.ProcessEnv {
  return { ...process.env, CLAUDE_CODE_ENABLE_TELEMETRY: '1', OTEL_METRICS_EXPORTER: 'otlp', OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_TRACES_EXPORTER: 'none', OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json', OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: endpoint + '/v1/metrics', OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: endpoint + '/v1/logs',
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: endpoint + '/v1/traces', OTEL_EXPORTER_OTLP_HEADERS: '',
    OTEL_EXPORTER_OTLP_METRICS_HEADERS: '', OTEL_EXPORTER_OTLP_LOGS_HEADERS: '', OTEL_EXPORTER_OTLP_TRACES_HEADERS: '',
    OTEL_METRIC_EXPORT_INTERVAL: '1000', OTEL_LOGS_EXPORT_INTERVAL: '1000', OTEL_TRACES_EXPORT_INTERVAL: '1000',
    OTEL_LOG_USER_PROMPTS: '0', OTEL_LOG_ASSISTANT_RESPONSES: '0', OTEL_LOG_TOOL_CONTENT: '0', OTEL_LOG_RAW_API_BODIES: '0',
    OTEL_RESOURCE_INCLUDE_HOST: '0', BETA_TRACING_ENDPOINT: '', ENABLE_BETA_TRACING_DETAILED: '0' };
}
