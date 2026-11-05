import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@/lib/apiBase';

const CODE = 'ETESTNETWORK';

describe('the test network guard', () => {
  it('refuses a fetch to another machine', async () => {
    const failure = await fetch('https://example.com/').then(() => null, (error: unknown) => error);
    expect((failure as { cause?: { code?: string } }).cause?.code).toBe(CODE);
  });

  it('refuses a fetch to the API address tests are configured with', async () => {
    const failure = await fetch(`${API_BASE_URL}/worlds/guard-probe`).then(() => null, (error: unknown) => error);
    expect((failure as { cause?: { code?: string } }).cause?.code).toBe(CODE);
  });

  it('refuses https.get', async () => {
    const code = await new Promise((resolve, reject) => {
      https.get('https://example.com/', () => reject(new Error('answered'))).on('error', (error: NodeJS.ErrnoException) => resolve(error.code));
    });
    expect(code).toBe(CODE);
  });

  it('refuses a raw socket given a port and host', async () => {
    const socket = new net.Socket();
    const code = await new Promise((resolve) => {
      socket.on('error', (error: NodeJS.ErrnoException) => resolve(error.code));
      socket.connect(443, 'example.com');
    });
    expect(code).toBe(CODE);
  });

  it('refuses net.connect, which hands the socket its arguments as one array', async () => {
    const code = await new Promise((resolve) => {
      net.connect(443, 'example.com').on('error', (error: NodeJS.ErrnoException) => resolve(error.code));
    });
    expect(code).toBe(CODE);
  });

  it('refuses a name that only starts like a loopback address', async () => {
    const socket = new net.Socket();
    const code = await new Promise((resolve) => {
      socket.on('error', (error: NodeJS.ErrnoException) => resolve(error.code));
      socket.connect({ port: 443, host: '127.example.com' });
    });
    expect(code).toBe(CODE);
  });

  it.each(['127.0.0.1', 'localhost'])('lets a test reach its own server on %s', async (host) => {
    const server = http.createServer((_request, response) => response.end('here'));
    await new Promise<void>((resolve) => server.listen(0, host, resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const answer = await fetch(`http://${host}:${port}/`, { headers: { connection: 'close' } });
      expect(await answer.text()).toBe('here');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('lets a test reach a local pipe', async () => {
    const pipe = process.platform === 'win32'
      ? `\\\\.\\pipe\\guard-${process.pid}`
      : path.join(os.tmpdir(), `guard-${process.pid}.sock`);
    const server = net.createServer((socket) => socket.end('here'));
    await new Promise<void>((resolve) => server.listen(pipe, resolve));
    try {
      const text = await new Promise((resolve, reject) => {
        net.connect(pipe).on('data', (data) => resolve(data.toString())).on('error', reject);
      });
      expect(text).toBe('here');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
