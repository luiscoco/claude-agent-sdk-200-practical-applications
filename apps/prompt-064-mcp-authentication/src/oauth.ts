import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const authorizationSchema = z
  .object({
    response_type: z.literal('code'),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    resource: z.string().url(),
    scope: z.literal('catalog.read'),
    state: z.string().min(32).max(128),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal('S256'),
  })
  .strict();
export const exchangeSchema = z
  .object({
    grant_type: z.literal('authorization_code'),
    code: z.string(),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    resource: z.string().url(),
    code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  })
  .strict();
export type AuthorizationRequest = z.infer<typeof authorizationSchema>;
export type TokenGrant = {
  reference: string;
  subject: string;
  scope: 'catalog.read';
  audience: string;
  expiresAt: number;
};
export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}
export function opaqueValue() {
  return randomBytes(32).toString('base64url');
}
function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export class ClassroomOAuth {
  readonly clientId = 'claude-course-classroom';
  readonly redirectUri: string;
  readonly audience: string;
  private codes = new Map<string, { request: AuthorizationRequest; expiresAt: number }>();
  private tokens = new Map<string, TokenGrant>();
  constructor(
    readonly issuer: string,
    private now = () => Date.now(),
  ) {
    this.redirectUri = issuer + '/auth/callback';
    this.audience = issuer + '/mcp';
  }
  validateAuthorization(value: unknown) {
    const request = authorizationSchema.parse(value);
    if (
      request.client_id !== this.clientId ||
      request.redirect_uri !== this.redirectUri ||
      request.resource !== this.audience
    )
      throw new Error('INVALID_AUTHORIZATION_REQUEST');
    return request;
  }
  issueCode(value: unknown) {
    const request = this.validateAuthorization(value);
    const code = opaqueValue();
    this.codes.set(code, { request, expiresAt: this.now() + 60000 });
    return code;
  }
  exchange(value: unknown) {
    const input = exchangeSchema.parse(value);
    const stored = this.codes.get(input.code);
    if (!stored || stored.expiresAt <= this.now()) {
      this.codes.delete(input.code);
      throw new Error('INVALID_GRANT');
    }
    const expected = stored.request;
    const actualChallenge = pkceChallenge(input.code_verifier);
    const correctChallenge = timingSafeEqual(
      Buffer.from(actualChallenge),
      Buffer.from(expected.code_challenge),
    );
    if (
      !correctChallenge ||
      input.client_id !== expected.client_id ||
      input.redirect_uri !== expected.redirect_uri ||
      input.resource !== expected.resource
    )
      throw new Error('INVALID_GRANT');
    this.codes.delete(input.code);
    const accessToken = opaqueValue();
    const grant: TokenGrant = {
      reference: randomUUID(),
      subject: 'classroom-learner',
      scope: 'catalog.read',
      audience: this.audience,
      expiresAt: this.now() + 900000,
    };
    this.tokens.set(fingerprint(accessToken), grant);
    return { accessToken, grant };
  }
  authenticate(authorization: string | undefined) {
    const token = authorization?.trim().match(/^Bearer +([A-Za-z0-9_-]{43})$/i)?.[1];
    if (!token) return null;
    const key = fingerprint(token);
    const grant = this.tokens.get(key);
    if (!grant) return null;
    if (grant.expiresAt <= this.now()) {
      this.tokens.delete(key);
      return null;
    }
    return grant.audience === this.audience && grant.scope === 'catalog.read' ? grant : null;
  }
  revoke(accessToken: string) {
    return this.tokens.delete(fingerprint(accessToken));
  }
  metadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: this.issuer + '/oauth/authorize',
      token_endpoint: this.issuer + '/oauth/token',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['catalog.read'],
      authorization_response_iss_parameter_supported: true,
    };
  }
  resourceMetadata() {
    return {
      resource: this.audience,
      authorization_servers: [this.issuer],
      scopes_supported: ['catalog.read'],
      bearer_methods_supported: ['header'],
      resource_name: 'Classroom catalog',
    };
  }
}

export type LoginTransaction = {
  state: string;
  verifier: string;
  issuer: string;
  tokenEndpoint: string;
  expiresAt: number;
};
export function validateCallback(
  transaction: LoginTransaction | undefined,
  state: unknown,
  issuer: unknown,
  now = Date.now(),
) {
  return Boolean(
    transaction &&
    transaction.expiresAt > now &&
    state === transaction.state &&
    issuer === transaction.issuer,
  );
}
