/**
 * Tauri Fetch Wrapper
 *
 * Workaround for Tauri HTTP plugin streamChannel bug.
 * Uses a Rust command to handle HTTP requests directly.
 */

import { invoke } from '@tauri-apps/api/core';

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: number[]; // Vec<u8> from Rust
}

/**
 * Custom Response-like object that works around Tauri HTTP plugin bugs
 */
class TauriResponse implements Response {
  private _body: Uint8Array<ArrayBuffer>;
  private _headers: Headers;
  private _status: number;
  private _statusText: string;
  private _bodyUsed = false;

  // Response interface properties
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected = false;
  readonly status: number;
  readonly statusText: string;
  readonly type: ResponseType = 'basic';
  readonly url: string;
  readonly body: ReadableStream<Uint8Array<ArrayBuffer>> | null = null;
  readonly bodyUsed: boolean;

  constructor(httpResponse: HttpResponse, url: string) {
    this._body = new Uint8Array(httpResponse.body) as Uint8Array<ArrayBuffer>;
    this._status = httpResponse.status;
    this._statusText = this.getStatusText(httpResponse.status);
    this.url = url;

    // Convert headers
    this._headers = new Headers();
    for (const [key, value] of Object.entries(httpResponse.headers)) {
      this._headers.set(key, value);
    }

    // Set readonly properties
    this.headers = this._headers;
    this.status = this._status;
    this.statusText = this._statusText;
    this.ok = this._status >= 200 && this._status < 300;
    this.bodyUsed = false;
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return statusTexts[status] || 'Unknown';
  }

  private ensureNotUsed(): void {
    if (this._bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this._bodyUsed = true;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    this.ensureNotUsed();
    return this._body.buffer.slice(
      this._body.byteOffset,
      this._body.byteOffset + this._body.byteLength
    );
  }

  async blob(): Promise<Blob> {
    this.ensureNotUsed();
    const contentType = this._headers.get('content-type') || 'application/octet-stream';
    return new Blob([this._body], { type: contentType });
  }

  async formData(): Promise<FormData> {
    throw new Error('FormData parsing not implemented');
  }

  async json<T = any>(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text);
  }

  async text(): Promise<string> {
    this.ensureNotUsed();
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(this._body);
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    this.ensureNotUsed();
    return this._body;
  }

  clone(): Response {
    if (this._bodyUsed) {
      throw new TypeError('Cannot clone a disturbed Response');
    }
    return new TauriResponse(
      {
        status: this._status,
        headers: Object.fromEntries(this._headers.entries()),
        body: Array.from(this._body),
      },
      this.url
    );
  }
}

/**
 * Fetch wrapper that uses Rust command to bypass Tauri HTTP plugin bugs
 * Compatible with standard fetch API signature
 */
export async function tauriFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Convert input to URL string
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  try {
    // Prepare headers
    let headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        headers = init.headers as Record<string, string>;
      }
    }

    // Prepare body if present
    let body: number[] | undefined;
    if (init?.body) {
      if (typeof init.body === 'string') {
        const encoder = new TextEncoder();
        body = Array.from(encoder.encode(init.body));
      } else if (init.body instanceof Uint8Array) {
        body = Array.from(init.body);
      } else if (init.body instanceof ArrayBuffer) {
        body = Array.from(new Uint8Array(init.body));
      } else if (init.body instanceof Blob) {
        const arrayBuffer = await init.body.arrayBuffer();
        body = Array.from(new Uint8Array(arrayBuffer));
      } else if (init.body instanceof FormData) {
        const boundary = '----TauriBoundary' + Math.random().toString(36).substring(2);
        headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
        const encoder = new TextEncoder();
        const parts: Uint8Array[] = [];
        for (const [key, value] of init.body.entries()) {
          if (value instanceof File) {
            parts.push(encoder.encode(
              `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${value.name}"\r\nContent-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`
            ));
            parts.push(new Uint8Array(await value.arrayBuffer()));
            parts.push(encoder.encode('\r\n'));
          } else {
            parts.push(encoder.encode(
              `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
            ));
          }
        }
        parts.push(encoder.encode(`--${boundary}--\r\n`));
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
          combined.set(part, offset);
          offset += part.length;
        }
        body = Array.from(combined);
      } else {
        throw new Error('Unsupported body type');
      }
    }

    // Call Rust command
    const response = await invoke<HttpResponse>('http_fetch', {
      url,
      method: init?.method || 'GET',
      headers,
      body,
    });

    // Return custom Response object
    return new TauriResponse(response, url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[tauriFetch] Error:', msg, '— URL:', url);
    throw new Error(`HTTP request failed: ${msg}`);
  }
}
