import http, { type ServerResponse } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

type Booking = { bookingId: string; requestKey: string; label: string };
type Entry = {
  id: string;
  key: string;
  fingerprint: string;
  phase: 'pending' | 'committed' | 'abandoned';
  booking: Booking | null;
  waiters: Set<ServerResponse>;
  timer: NodeJS.Timeout | null;
  completion: Promise<Booking | null>;
  complete: (booking: Booking | null) => void;
};
type Receipt = {
  id: string;
  requestKey: string;
  operationId: string;
  replayed: boolean;
  responseSent: boolean;
  clientClosedBeforeReply: boolean;
  bookingId: string | null;
  phase: 'waiting' | 'replied' | 'disconnected' | 'conflict';
};
const bodySchema = z.object({ label: z.string().min(1).max(120) }).strict();

function waitForReplyDelay(response: ServerResponse, milliseconds: number) {
  if (response.destroyed) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const closed = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      response.off('close', closed);
      resolve(!response.destroyed);
    }, milliseconds);
    response.once('close', closed);
  });
}

export async function startClassroomApi(options: {
  processingMs: number;
  replyDelayMs: number;
  onAccepted?: () => void;
}) {
  const entries = new Map<string, Entry>();
  const operations: Entry[] = [];
  const bookings: Booking[] = [];
  const receipts: Receipt[] = [];
  const activeResponses = new Set<ServerResponse>();
  const idleWaiters = new Set<() => void>();
  const idle = () =>
    activeResponses.size === 0 && operations.every((entry) => entry.phase !== 'pending');
  function notifyIdle() {
    if (!idle()) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  }
  function abandon(entry: Entry) {
    if (entry.phase !== 'pending') return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.phase = 'abandoned';
    entries.delete(entry.key);
    entry.complete(null);
    notifyIdle();
  }
  async function serve(request: http.IncomingMessage, response: ServerResponse) {
    if (request.method === 'GET' && request.url === '/health') {
      response
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ ready: true }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/bookings') {
      response.writeHead(404).end();
      return;
    }
    activeResponses.add(response);
    let attached: Entry | undefined;
    let receipt: Receipt | undefined;
    response.once('finish', () => {
      activeResponses.delete(response);
      attached?.waiters.delete(response);
      if (receipt) receipt.phase = receipt.phase === 'conflict' ? 'conflict' : 'replied';
      notifyIdle();
    });
    response.once('close', () => {
      activeResponses.delete(response);
      if (receipt && !response.writableEnded) {
        receipt.clientClosedBeforeReply = true;
        receipt.phase = 'disconnected';
      }
      if (attached) {
        attached.waiters.delete(response);
        if (attached.waiters.size === 0) abandon(attached);
      }
      notifyIdle();
    });
    const key = z.string().uuid().parse(request.headers['idempotency-key']);
    let bodyText = '';
    for await (const chunk of request) {
      bodyText += chunk.toString();
      if (bodyText.length > 4096) throw new Error('INVALID_BODY');
    }
    const body = bodySchema.parse(JSON.parse(bodyText));
    const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const existing = entries.get(key);
    receipt = {
      id: randomUUID(),
      requestKey: key,
      operationId: existing?.id ?? '',
      replayed: Boolean(existing),
      responseSent: false,
      clientClosedBeforeReply: false,
      bookingId: null,
      phase: 'waiting',
    };
    receipts.push(receipt);
    options.onAccepted?.();
    if (existing && existing.fingerprint !== fingerprint) {
      receipt.phase = 'conflict';
      receipt.responseSent = true;
      response
        .writeHead(409, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ errorCode: 'IDEMPOTENCY_CONFLICT' }));
      return;
    }
    let entry = existing;
    if (!entry) {
      let complete!: (booking: Booking | null) => void;
      const completion = new Promise<Booking | null>((resolve) => {
        complete = resolve;
      });
      entry = {
        id: randomUUID(),
        key,
        fingerprint,
        phase: 'pending',
        booking: null,
        waiters: new Set(),
        timer: null,
        completion,
        complete,
      };
      entries.set(key, entry);
      operations.push(entry);
      const operation = entry;
      operation.timer = setTimeout(() => {
        if (operation.phase !== 'pending') return;
        const booking = {
          bookingId: 'classroom-booking-' + (bookings.length + 1),
          requestKey: key,
          label: body.label,
        };
        operation.phase = 'committed';
        operation.booking = booking;
        bookings.push(booking);
        operation.complete(booking);
        notifyIdle();
      }, options.processingMs);
    }
    attached = entry;
    entry.waiters.add(response);
    receipt.operationId = entry.id;
    if (response.destroyed) {
      entry.waiters.delete(response);
      if (entry.waiters.size === 0) abandon(entry);
      return;
    }
    const booking = await entry.completion;
    if (!booking || response.destroyed) return;
    receipt.bookingId = booking.bookingId;
    const mayReply =
      Boolean(existing) ||
      options.replyDelayMs === 0 ||
      (await waitForReplyDelay(response, options.replyDelayMs));
    if (!mayReply || response.destroyed) return;
    receipt.responseSent = true;
    response
      .writeHead(existing ? 200 : 201, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ ...booking, replayed: Boolean(existing) }));
  }
  const server = http.createServer((request, response) => {
    void serve(request, response).catch(() => {
      if (!response.destroyed && !response.writableEnded)
        response
          .writeHead(400, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ errorCode: 'INVALID_REQUEST' }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Classroom API did not obtain a local port.');
  const baseUrl = 'http://127.0.0.1:' + address.port;
  try {
    const ready = await fetch(baseUrl + '/health', { signal: AbortSignal.timeout(10000) });
    if (!ready.ok) throw new Error('Classroom HTTP transport was not ready.');
    await ready.arrayBuffer();
  } catch (error) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    throw error;
  }
  return {
    url: baseUrl + '/bookings',
    snapshot() {
      return {
        bookings: bookings.map((item) => ({ ...item })),
        receipts: receipts.map((item) => ({ ...item })),
        operations: operations.map((entry) => ({
          id: entry.id,
          requestKey: entry.key,
          phase: entry.phase,
          bookingId: entry.booking?.bookingId ?? null,
        })),
      };
    },
    async waitForIdle() {
      if (idle()) return;
      await new Promise<void>((resolve, reject) => {
        const finished = () => {
          clearTimeout(timer);
          idleWaiters.delete(finished);
          resolve();
        };
        const timer = setTimeout(() => {
          idleWaiters.delete(finished);
          reject(new Error('Classroom API did not settle.'));
        }, 15000);
        idleWaiters.add(finished);
      });
    },
    async close() {
      for (const entry of operations) abandon(entry);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
