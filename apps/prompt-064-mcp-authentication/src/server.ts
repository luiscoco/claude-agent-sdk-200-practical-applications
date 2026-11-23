import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import 'dotenv/config';
import {
  ClassroomOAuth,
  opaqueValue,
  pkceChallenge,
  validateCallback,
  type AuthorizationRequest,
  type LoginTransaction,
} from './oauth.js';
import { handleMcp, type Execution, type HttpEvent } from './mcp.js';
import { runAuthenticated } from './agent.js';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 43164);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must identify a stable TCP port from 1 to 65535.');
const origin = new URL(`http://127.0.0.1:${port}`).origin;
const oauth = new ClassroomOAuth(origin);
type LoginEvidence = {
  metadataDiscovered: boolean;
  stateValidated: boolean;
  issuerValidated: boolean;
  pkceS256ExchangeSucceeded: boolean;
};
type Session = {
  accessToken?: string;
  transaction?: LoginTransaction;
  connecting: boolean;
  revoked: boolean;
  evidence?: LoginEvidence;
  error?: string;
};
const sessions = new Map<string, Session>();
const consentRequests = new Map<string, { request: AuthorizationRequest; expiresAt: number }>();
const executions: Execution[] = [];
const httpEvents: HttpEvent[] = [];
const reports = new Map<string, string>();
let busy = false;
const app = express();
app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  response.setHeader('Referrer-Policy', 'same-origin');
  if (request.headers.host !== new URL(origin).host) {
    response.status(403).json({ error: 'Unexpected classroom host.' });
    return;
  }
  if (request.method === 'POST' && request.headers.origin && request.headers.origin !== origin) {
    response.status(403).json({ error: 'Unexpected request origin.' });
    return;
  }
  if (
    request.path.startsWith('/api/') ||
    request.path.startsWith('/auth/') ||
    request.path.startsWith('/oauth/')
  )
    response.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '4kb' }));
app.use(express.static(path.join(root, 'public')));
function sessionFor(request: express.Request) {
  const id = request.headers.cookie?.match(/(?:^|;\s*)course64=([a-f0-9]{48})(?:;|$)/)?.[1];
  return id ? sessions.get(id) : undefined;
}
function ensureSession(request: express.Request, response: express.Response) {
  const existing = sessionFor(request);
  if (existing) return existing;
  const id = randomBytes(24).toString('hex');
  const session: Session = { connecting: false, revoked: false };
  sessions.set(id, session);
  response.setHeader('Set-Cookie', `course64=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800`);
  return session;
}
function sessionStatus(session: Session | undefined) {
  const grant = session?.accessToken ? oauth.authenticate('Bearer ' + session.accessToken) : null;
  return {
    connected: Boolean(grant),
    credentialPresent: Boolean(session?.accessToken),
    connecting: session?.connecting ?? false,
    subject: grant?.subject ?? null,
    scope: grant?.scope ?? null,
    expiresAt: grant ? new Date(grant.expiresAt).toISOString() : null,
    revoked: session?.revoked ?? false,
    evidence: session?.evidence ?? null,
    error: session?.error ?? '',
  };
}
function consentPage(requestId?: string, error = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Classroom OAuth consent</title><link rel="stylesheet" href="/styles.css"></head>
  <body class="oauth-page"><header><strong class="brand"><span>✳</span> Claude</strong><b>Prompt 64</b><span>Classroom authorization server</span></header>
  <main><section class="panel"><div class="heading"><span class="icon orange">✓</span><h1>Connect the classroom catalog</h1></div>
  <p>This local identity fixture supplies the classroom learner. The application completes an authorization-code flow with S256 PKCE.</p>
  <pre>Identity fixture · classroom-learner\nRequested scope · catalog.read\nRegistered client · claude-course-classroom\nResource · ${oauth.audience}</pre>
  ${requestId ? `<form method="post" action="/oauth/decision"><input type="hidden" name="requestId" value="${requestId}"><button id="authorize" class="primary" name="decision" value="approve">Authorize classroom catalog access</button><button id="deny" class="secondary" name="decision" value="deny">Decline</button></form>` : `<p role="alert">${error}</p><a class="secondary" href="/">Return to the lesson</a>`}
  </section></main></body></html>`;
}
app.get('/.well-known/oauth-protected-resource/mcp', (_request, response) =>
  response.json(oauth.resourceMetadata()),
);
app.get('/.well-known/oauth-authorization-server', (_request, response) =>
  response.json(oauth.metadata()),
);
app.get('/auth/start', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active SDK experiment.' });
    return;
  }
  const session = ensureSession(request, response);
  session.connecting = true;
  session.error = '';
  try {
    const resourceResponse = await fetch(origin + '/.well-known/oauth-protected-resource/mcp', {
      signal: AbortSignal.timeout(20000),
    });
    const resource = z
      .object({
        resource: z.literal(oauth.audience),
        authorization_servers: z.array(z.string().url()),
      })
      .passthrough()
      .parse(await resourceResponse.json());
    if (!resourceResponse.ok || !resource.authorization_servers.includes(origin))
      throw new Error('UNTRUSTED_RESOURCE_METADATA');
    const metadataResponse = await fetch(origin + '/.well-known/oauth-authorization-server', {
      signal: AbortSignal.timeout(20000),
    });
    const metadata = z
      .object({
        issuer: z.literal(origin),
        authorization_endpoint: z.literal(origin + '/oauth/authorize'),
        token_endpoint: z.literal(origin + '/oauth/token'),
        code_challenge_methods_supported: z.array(z.string()),
        authorization_response_iss_parameter_supported: z.literal(true),
      })
      .passthrough()
      .parse(await metadataResponse.json());
    if (!metadataResponse.ok || !metadata.code_challenge_methods_supported.includes('S256'))
      throw new Error('INVALID_AUTHORIZATION_METADATA');
    const verifier = opaqueValue(),
      state = opaqueValue();
    session.transaction = {
      state,
      verifier,
      issuer: metadata.issuer,
      tokenEndpoint: metadata.token_endpoint,
      expiresAt: Date.now() + 300000,
    };
    session.evidence = {
      metadataDiscovered: true,
      stateValidated: false,
      issuerValidated: false,
      pkceS256ExchangeSucceeded: false,
    };
    const url = new URL(metadata.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: oauth.clientId,
      redirect_uri: oauth.redirectUri,
      resource: oauth.audience,
      scope: 'catalog.read',
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString();
    response.redirect(url.href);
  } catch {
    session.connecting = false;
    delete session.transaction;
    session.error = 'METADATA_DISCOVERY_FAILED';
    response.redirect('/?auth=discovery_failed');
  }
});
app.get('/oauth/authorize', (request, response) => {
  try {
    const authorization = oauth.validateAuthorization(request.query);
    const requestId = opaqueValue();
    consentRequests.set(requestId, { request: authorization, expiresAt: Date.now() + 300000 });
    response.send(consentPage(requestId));
  } catch {
    response
      .status(400)
      .send(
        consentPage(
          undefined,
          'This classroom authorization request is invalid. Return to the lesson and reconnect.',
        ),
      );
  }
});
app.post('/oauth/decision', (request, response) => {
  const parsed = z
    .object({ requestId: z.string(), decision: z.enum(['approve', 'deny']) })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'INVALID_CONSENT_DECISION' });
    return;
  }
  const { requestId, decision } = parsed.data;
  const stored = consentRequests.get(requestId);
  if (!stored || stored.expiresAt <= Date.now()) {
    consentRequests.delete(requestId);
    response
      .status(400)
      .send(
        consentPage(
          undefined,
          'This classroom request expired. Return to the lesson and reconnect.',
        ),
      );
    return;
  }
  consentRequests.delete(requestId);
  const callback = new URL(stored.request.redirect_uri);
  callback.searchParams.set('state', stored.request.state);
  callback.searchParams.set('iss', oauth.issuer);
  if (decision === 'deny') callback.searchParams.set('error', 'access_denied');
  else callback.searchParams.set('code', oauth.issueCode(stored.request));
  response.redirect(303, callback.href);
});
app.post('/oauth/token', (request, response) => {
  try {
    const issued = oauth.exchange(request.body);
    response.json({
      access_token: issued.accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      scope: issued.grant.scope,
    });
  } catch {
    response.status(400).json({ error: 'invalid_grant' });
  }
});
app.get('/auth/callback', async (request, response) => {
  const session = sessionFor(request);
  const transaction = session?.transaction;
  if (
    !session ||
    !transaction ||
    !validateCallback(transaction, request.query.state, request.query.iss)
  ) {
    response
      .status(400)
      .send(
        consentPage(
          undefined,
          'The callback state, issuer or transaction lifetime did not match. Return to the lesson and reconnect.',
        ),
      );
    return;
  }
  session.evidence = {
    metadataDiscovered: true,
    stateValidated: true,
    issuerValidated: true,
    pkceS256ExchangeSucceeded: false,
  };
  if (request.query.error) {
    session.connecting = false;
    delete session.transaction;
    session.error = 'ACCESS_DENIED';
    response.redirect('/?auth=access_denied');
    return;
  }
  if (typeof request.query.code !== 'string') {
    session.connecting = false;
    delete session.transaction;
    session.error = 'MISSING_CODE';
    response.redirect('/?auth=invalid');
    return;
  }
  try {
    const result = await fetch(transaction.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: request.query.code,
        client_id: oauth.clientId,
        redirect_uri: oauth.redirectUri,
        resource: oauth.audience,
        code_verifier: transaction.verifier,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const token = z
      .object({
        access_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        token_type: z.literal('Bearer'),
        expires_in: z.number().positive(),
        scope: z.literal('catalog.read'),
      })
      .parse(await result.json());
    if (!result.ok || !oauth.authenticate('Bearer ' + token.access_token))
      throw new Error('TOKEN_EXCHANGE_FAILED');
    if (session.accessToken) oauth.revoke(session.accessToken);
    session.accessToken = token.access_token;
    session.revoked = false;
    session.error = '';
    session.evidence = {
      metadataDiscovered: true,
      stateValidated: true,
      issuerValidated: true,
      pkceS256ExchangeSucceeded: true,
    };
    delete session.transaction;
    session.connecting = false;
    response.redirect('/?auth=connected');
  } catch {
    session.connecting = false;
    delete session.transaction;
    session.error = 'TOKEN_EXCHANGE_FAILED';
    response.redirect('/?auth=exchange_failed');
  }
});
app.get('/api/auth/status', (request, response) =>
  response.json(sessionStatus(sessionFor(request))),
);
app.post('/api/auth/revoke', (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active SDK experiment.' });
    return;
  }
  const session = sessionFor(request);
  if (!session?.accessToken) {
    response.status(409).json({ error: 'Connect the classroom account first.' });
    return;
  }
  const revoked = oauth.revoke(session.accessToken);
  session.revoked = true;
  response.json({ revoked, status: sessionStatus(session) });
});
app.post('/mcp', (request, response) =>
  handleMcp(request, response, oauth, root, executions, httpEvents),
);
app.get('/mcp', (request, response) =>
  handleMcp(request, response, oauth, root, executions, httpEvents),
);
app.delete('/mcp', (request, response) =>
  handleMcp(request, response, oauth, root, executions, httpEvents),
);
app.get('/api/config', (request, response) =>
  response.json({
    defaultInput: { slug: 'local-mcp' },
    auth: sessionStatus(sessionFor(request)),
    identitySource: 'local-classroom-fixture',
    resource: oauth.audience,
  }),
);
app.post('/api/run', async (request, response) => {
  const session = sessionFor(request);
  if (busy || session?.connecting) {
    response.status(409).json({ error: 'Finish the active connection or SDK experiment first.' });
    return;
  }
  busy = true;
  try {
    const report = {
      id: randomUUID(),
      ...(await runAuthenticated(
        request.body,
        session?.accessToken,
        oauth,
        executions,
        httpEvents,
      )),
      oauthFlow: session?.evidence ?? null,
      identitySource: 'local-classroom-fixture',
    };
    const text = JSON.stringify(report, null, 2);
    if (session?.accessToken && text.includes(session.accessToken))
      throw new Error('REPORT_REDACTION_FAILED');
    if (process.env.ANTHROPIC_API_KEY && text.includes(process.env.ANTHROPIC_API_KEY))
      throw new Error('REPORT_REDACTION_FAILED');
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, text);
    reports.set(report.id, file);
    response.json(report);
  } catch (error) {
    response.status(422).json({
      error: error instanceof Error ? error.message : 'Authenticated MCP experiment failed.',
    });
  } finally {
    busy = false;
  }
});
const sources = ['src/agent.ts', 'src/oauth.ts', 'src/mcp.ts', 'src/privacy.ts', 'src/server.ts'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
app.get('/api/report/:id', (request, response) => {
  const file = reports.get(String(request.params.id));
  if (!file) {
    response.status(404).end();
    return;
  }
  response.download(file, 'authenticated-mcp-observed-report.json');
});
app.listen(port, '127.0.0.1', () => console.log(`Prompt 64 lab ${origin}`));
