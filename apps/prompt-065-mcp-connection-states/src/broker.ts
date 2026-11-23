import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export async function startClassroomBroker() {
  const credential = randomBytes(32).toString('base64url');
  let baseUrl = '';
  const events: Array<{ method: string; authorized: boolean; status: number | null }> = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', baseUrl);
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    if (url.pathname === '/.well-known/oauth-protected-resource/mcp') {
      json(200, {
        resource: baseUrl + '/mcp',
        authorization_servers: [baseUrl],
        scopes_supported: ['probe.read'],
        bearer_methods_supported: ['header'],
      });
      return;
    }
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      json(200, {
        issuer: baseUrl,
        authorization_endpoint: baseUrl + '/authorize',
        token_endpoint: baseUrl + '/token',
        registration_endpoint: baseUrl + '/register',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: ['probe.read'],
        authorization_response_iss_parameter_supported: true,
      });
      return;
    }
    if (url.pathname === '/register' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 8192) {
          json(413, { error: 'invalid_client_metadata' });
          return;
        }
      }
      try {
        const metadata = JSON.parse(body);
        if (
          !Array.isArray(metadata.redirect_uris) ||
          !metadata.redirect_uris.every((value: unknown) => typeof value === 'string')
        ) {
          json(400, { error: 'invalid_redirect_uri' });
          return;
        }
        json(201, {
          client_id: 'classroom-public-state-probe',
          redirect_uris: metadata.redirect_uris,
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
        });
      } catch {
        json(400, { error: 'invalid_client_metadata' });
      }
      return;
    }
    if (url.pathname !== '/mcp') {
      json(404, { error: 'Classroom route unavailable.' });
      return;
    }
    const authorized = request.headers.authorization === 'Bearer ' + credential;
    const event = { method: request.method || '', authorized, status: null as number | null };
    events.push(event);
    response.once('finish', () => {
      event.status = response.statusCode;
    });
    if (!authorized) {
      response.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp", scope="probe.read"`,
      );
      json(401, { error: 'invalid_token' });
      return;
    }
    const mcp = new McpServer({ name: 'classroom-credentialed-resource', version: '1.0.0' });
    mcp.registerTool(
      'ping',
      {
        description: 'Return the synthetic classroom resource status.',
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () => ({ content: [{ type: 'text', text: 'Classroom resource available.' }] }),
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.once('close', () => {
      void Promise.allSettled([transport.close(), mcp.close()]);
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) json(500, { error: 'Classroom MCP request failed.' });
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Classroom broker did not bind a TCP port.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    url: baseUrl + '/mcp',
    credential,
    events,
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}
