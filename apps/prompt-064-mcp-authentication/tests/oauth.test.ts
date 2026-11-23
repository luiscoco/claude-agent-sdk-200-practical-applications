import test from 'node:test';
import assert from 'node:assert/strict';
import { ClassroomOAuth, opaqueValue, pkceChallenge, validateCallback } from '../src/oauth.js';
import { publicReport } from '../src/privacy.js';

function setup() {
  let now = 100000;
  const oauth = new ClassroomOAuth('http://127.0.0.1:43164', () => now);
  const verifier = opaqueValue();
  const authorization = {
    response_type: 'code',
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    resource: oauth.audience,
    scope: 'catalog.read',
    state: opaqueValue(),
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
  };
  const exchange = {
    grant_type: 'authorization_code',
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    resource: oauth.audience,
    code_verifier: verifier,
  };
  return {
    oauth,
    authorization,
    exchange,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}
test('PKCE exchange creates a bound token and consumes the authorization code once', () => {
  const { oauth, authorization, exchange } = setup();
  const code = oauth.issueCode(authorization);
  const issued = oauth.exchange({ ...exchange, code });
  assert.equal(oauth.authenticate('Bearer ' + issued.accessToken)?.subject, 'classroom-learner');
  assert.equal(issued.grant.audience, oauth.audience);
  assert.equal(oauth.authenticate('bearer  ' + issued.accessToken)?.subject, 'classroom-learner');
  assert.throws(() => oauth.exchange({ ...exchange, code }), /INVALID_GRANT/);
  assert.equal(oauth.authenticate(issued.accessToken), null);
});
test('wrong verifier, redirect and audience fail before token creation', () => {
  const { oauth, authorization, exchange } = setup();
  const code = oauth.issueCode(authorization);
  assert.throws(
    () => oauth.exchange({ ...exchange, code, code_verifier: opaqueValue() }),
    /INVALID_GRANT/,
  );
  assert.throws(
    () => oauth.exchange({ ...exchange, code, resource: 'http://127.0.0.1:43164/other' }),
    /INVALID_GRANT/,
  );
  assert.throws(
    () => oauth.exchange({ ...exchange, code, redirect_uri: 'http://127.0.0.1:43164/other' }),
    /INVALID_GRANT/,
  );
  assert.equal(oauth.exchange({ ...exchange, code }).grant.scope, 'catalog.read');
  assert.throws(
    () => oauth.issueCode({ ...authorization, redirect_uri: 'https://example.com/callback' }),
    /INVALID_AUTHORIZATION_REQUEST/,
  );
});
test('code expiry, token expiry and revocation are enforced', () => {
  const { oauth, authorization, exchange, advance } = setup();
  const expiredCode = oauth.issueCode(authorization);
  advance(60001);
  assert.throws(() => oauth.exchange({ ...exchange, code: expiredCode }), /INVALID_GRANT/);
  const first = oauth.exchange({ ...exchange, code: oauth.issueCode(authorization) });
  assert.equal(oauth.revoke(first.accessToken), true);
  assert.equal(oauth.authenticate('Bearer ' + first.accessToken), null);
  const second = oauth.exchange({ ...exchange, code: oauth.issueCode(authorization) });
  advance(900001);
  assert.equal(oauth.authenticate('Bearer ' + second.accessToken), null);
});
test('callback requires the recorded state, issuer and unexpired transaction', () => {
  const transaction = {
    state: 'expected',
    verifier: 'private',
    issuer: 'http://127.0.0.1:43164',
    tokenEndpoint: 'http://127.0.0.1:43164/oauth/token',
    expiresAt: 200,
  };
  assert.equal(validateCallback(transaction, 'expected', transaction.issuer, 100), true);
  assert.equal(validateCallback(transaction, 'other', transaction.issuer, 100), false);
  assert.equal(validateCallback(transaction, 'expected', 'http://other', 100), false);
  assert.equal(validateCallback(transaction, 'expected', undefined, 100), false);
  assert.equal(validateCallback(transaction, 'expected', transaction.issuer, 201), false);
});
test('report redaction removes credential values in nested headers and errors', () => {
  const secret = 'SYNTHETIC_CLASSROOM_CREDENTIAL';
  const report = publicReport(
    {
      config: { headers: { Authorization: 'Bearer ' + secret } },
      error: 'Rejected ' + secret,
      subject: 'classroom-learner',
    },
    [secret, undefined],
  );
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(report.config.headers.Authorization, 'Bearer [REDACTED]');
  assert.equal(report.subject, 'classroom-learner');
  assert.equal(report.privacyChecks.credentialValuesAbsent, true);
});
