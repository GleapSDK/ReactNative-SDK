import {
  BINARY_BODY,
  BODY_NOT_CAPTURED,
  BODY_PENDING,
  STREAMING_BODY,
  compileNetworkLogRedaction,
  mergeNetworkLogLists,
  redactNetworkLogEntry,
} from './networkLogSanitizer';
import type {
  NetworkLogEntry,
  NetworkLogHeaders,
  NetworkLogRedactionRules,
} from './networkLogSanitizer';

export const MAX_BODY_LENGTH = 150000;
const MAX_FORM_VALUE_LENGTH = 10000;
const MAX_ERROR_LENGTH = 1000;
const PUSH_DELAY_MS = 500;
const DEFAULT_MAX_REQUESTS = 30;
const MAX_REQUESTS_LIMIT = 70;

const TEXT_CONTENT_TYPES = [
  'json',
  'xml',
  'text/',
  'javascript',
  'x-www-form-urlencoded',
  'graphql',
];
const STREAMING_CONTENT_TYPES = [
  'text/event-stream',
  'application/x-ndjson',
  'application/stream+json',
  'multipart/x-mixed-replace',
  'grpc',
];

type LogRecord = {
  startedAt: number;
  entry: NetworkLogEntry;
  // A response or a failure was recorded; only finished entries are pushed.
  done: boolean;
  // Dropped by the ring buffer (or discarded); late updates are ignored.
  evicted: boolean;
  revision: number;
  redacted?: {
    revision: number;
    rulesVersion: number;
    value: NetworkLogEntry | null;
  };
};

type XhrState = {
  method: string;
  url: string;
  headers: NetworkLogHeaders;
  // Opened by the fetch polyfill: the fetch hook logs this request.
  skip: boolean;
  record: LogRecord | null;
  failure: string | null;
  listening: boolean;
};

function includesAny(value: string, needles: string[]): boolean {
  const lower = value.toLowerCase();
  for (const needle of needles) {
    if (lower.indexOf(needle) !== -1) {
      return true;
    }
  }
  return false;
}

function isStreamingContentType(contentType: string): boolean {
  return includesAny(contentType, STREAMING_CONTENT_TYPES);
}

function isTextContentType(contentType: string): boolean {
  return includesAny(contentType, TEXT_CONTENT_TYPES);
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function capBody(text: string): string {
  if (text.length <= MAX_BODY_LENGTH) {
    return text;
  }
  let end = MAX_BODY_LENGTH;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) {
    end -= 1;
  }
  return text.slice(0, end) + '\n… [truncated, ' + utf8Length(text) + ' bytes]';
}

// NUL or replacement characters in the head: the body was not UTF-8 text.
function looksBinary(text: string): boolean {
  const sample = text.slice(0, 1000);
  return sample.indexOf('\u0000') !== -1 || sample.indexOf('�') !== -1;
}

// Reads a Blob as text through FileReader (React Native has no Blob.text()).
function readBlobAsText(blob: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new (global as any).FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    } catch (e) {
      reject(e);
    }
  });
}

// The head of a body cut at a byte offset: a split character becomes U+FFFD.
function captureTextHead(
  text: unknown,
  contentType: string,
  totalBytes: number
): string {
  const captured = captureText(text, contentType);
  if (
    typeof text !== 'string' ||
    captured === BINARY_BODY ||
    captured === STREAMING_BODY ||
    captured === BODY_NOT_CAPTURED
  ) {
    return captured;
  }
  return (
    text.replace(/\uFFFD+$/, '') + '\n… [truncated, ' + totalBytes + ' bytes]'
  );
}

function captureText(text: unknown, contentType: string): string {
  if (typeof text !== 'string') {
    return BODY_NOT_CAPTURED;
  }
  if (isStreamingContentType(contentType)) {
    return STREAMING_BODY;
  }
  if (contentType && !isTextContentType(contentType)) {
    return BINARY_BODY;
  }
  if (!contentType && looksBinary(text)) {
    return BINARY_BODY;
  }
  return capBody(text);
}

function addHeader(
  headers: NetworkLogHeaders,
  name: unknown,
  value: unknown
): void {
  if (typeof name !== 'string' || !name) {
    return;
  }
  const text =
    value === undefined || value === null
      ? ''
      : Array.isArray(value)
      ? value.join(', ')
      : String(value);
  const lower = name.toLowerCase();
  for (const existing of Object.keys(headers)) {
    if (existing.toLowerCase() === lower) {
      headers[existing] = headers[existing] + ', ' + text;
      return;
    }
  }
  headers[name] = text;
}

// Plain object, [name, value] pairs, Headers or Map.
function normalizeHeaders(source: any): NetworkLogHeaders {
  const headers: NetworkLogHeaders = {};
  if (!source || typeof source !== 'object') {
    return headers;
  }
  if (Array.isArray(source)) {
    for (const pair of source) {
      if (Array.isArray(pair) && pair.length >= 2) {
        addHeader(headers, pair[0], pair[1]);
      }
    }
    return headers;
  }
  if (
    typeof source.forEach === 'function' &&
    typeof source.get === 'function'
  ) {
    source.forEach((value: unknown, name: unknown) =>
      addHeader(headers, name, value)
    );
    return headers;
  }
  for (const name of Object.keys(source)) {
    addHeader(headers, name, source[name]);
  }
  return headers;
}

function parseRawHeaders(raw: unknown): NetworkLogHeaders {
  const headers: NetworkLogHeaders = {};
  if (typeof raw !== 'string') {
    return headers;
  }
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      addHeader(
        headers,
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim()
      );
    }
  }
  return headers;
}

function headerValue(headers: NetworkLogHeaders, name: string): string {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) {
      return headers[key] || '';
    }
  }
  return '';
}

function normalizeMethod(method: unknown): string {
  return (typeof method === 'string' && method ? method : 'GET').toUpperCase();
}

function normalizeUrl(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input && typeof input === 'object') {
    const candidate = input as { url?: unknown; href?: unknown };
    if (typeof candidate.url === 'string') {
      return candidate.url;
    }
    if (typeof candidate.href === 'string') {
      return candidate.href;
    }
  }
  return String(input);
}

function isInstance(value: unknown, name: string): boolean {
  const type = (global as any)[name];
  try {
    if (typeof type === 'function' && value instanceof type) {
      return true;
    }
  } catch (e) {}
  return Object.prototype.toString.call(value) === '[object ' + name + ']';
}

function describeFormValue(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    const name =
      typeof value.name === 'string'
        ? value.name
        : typeof value.fileName === 'string'
        ? value.fileName
        : '';
    const type = typeof value.type === 'string' ? value.type : '';
    return '[file' + (name ? ' ' + name : '') + (type ? ', ' + type : '') + ']';
  }
  const text = String(value);
  return text.length > MAX_FORM_VALUE_LENGTH
    ? text.slice(0, MAX_FORM_VALUE_LENGTH) + '… [truncated]'
    : text;
}

// FormData as a JSON object of its fields (files described, not read), so the
// JSON redaction applies to form fields too.
function summarizeFormData(formData: any): string {
  let parts: unknown[] | null = null;
  if (Array.isArray(formData._parts)) {
    parts = formData._parts;
  } else if (typeof formData.entries === 'function') {
    parts = Array.from(formData.entries());
  }
  if (!parts) {
    return BODY_NOT_CAPTURED;
  }
  const summary: { [key: string]: string | string[] } = Object.create(null);
  for (const part of parts) {
    if (!Array.isArray(part) || part.length < 2) {
      continue;
    }
    const key = String(part[0]);
    const value = describeFormValue(part[1]);
    const existing = summary[key];
    if (existing === undefined) {
      summary[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      summary[key] = [existing, value];
    }
  }
  return JSON.stringify(summary);
}

function normalizeRequestBody(body: any, contentType: string): string {
  if (body === undefined || body === null) {
    return '';
  }
  if (typeof body === 'string') {
    return captureText(body, contentType);
  }
  if (typeof body === 'number' || typeof body === 'boolean') {
    return String(body);
  }
  if (isInstance(body, 'URLSearchParams')) {
    return capBody(String(body));
  }
  if (
    isInstance(body, 'FormData') ||
    (Array.isArray(body._parts) && typeof body.append === 'function')
  ) {
    return capBody(summarizeFormData(body));
  }
  if (
    isInstance(body, 'Blob') ||
    isInstance(body, 'ArrayBuffer') ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body))
  ) {
    return BINARY_BODY;
  }
  return BODY_NOT_CAPTURED;
}

function describeError(error: any): string {
  if (error && typeof error === 'object') {
    if (error.name === 'AbortError') {
      return 'Request aborted';
    }
    if (typeof error.message === 'string' && error.message) {
      return error.message.slice(0, MAX_ERROR_LENGTH);
    }
  }
  if (typeof error === 'string' && error) {
    return error.slice(0, MAX_ERROR_LENGTH);
  }
  return 'Network request failed';
}

function readXhrErrorText(xhr: any): string {
  try {
    // React Native puts the native error message into responseText.
    if (
      (xhr.responseType === '' || xhr.responseType === 'text') &&
      typeof xhr.responseText === 'string'
    ) {
      return xhr.responseText.slice(0, MAX_ERROR_LENGTH);
    }
  } catch (e) {}
  return '';
}

function readXhrBody(xhr: any, contentType: string): string {
  if (isStreamingContentType(contentType)) {
    return STREAMING_BODY;
  }
  if (contentType && !isTextContentType(contentType)) {
    return BINARY_BODY;
  }
  const responseType = xhr.responseType || '';
  if (responseType === '' || responseType === 'text') {
    return captureText(xhr.responseText, contentType);
  }
  if (responseType === 'json') {
    // React Native keeps the raw text; browsers only expose the parsed value.
    if (typeof xhr._response === 'string') {
      return captureText(xhr._response, contentType);
    }
    return captureText(JSON.stringify(xhr.response), contentType);
  }
  // blob, arraybuffer and document responses are not read.
  return BODY_NOT_CAPTURED;
}

class GleapNetworkIntercepter {
  maxRequests = DEFAULT_MAX_REQUESTS;
  stopped = false;
  initialized = false;
  // > 0 while the original fetch runs synchronously. React Native's fetch is
  // built on XMLHttpRequest and opens its XHR in that window; those XHRs are
  // logged by the fetch hook, not a second time by the XHR hook.
  fetchDepth = 0;

  private records: LogRecord[] = [];
  private xhrStates = new WeakMap<object, XhrState>();
  private updatedCallback: ((networkLogs: NetworkLogEntry[]) => void) | null =
    null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private localPropsToIgnore: string[] = [];
  private remotePropsToIgnore: string[] = [];
  private localBlacklist: string[] = [];
  private remoteBlacklist: string[] = [];
  private rules: NetworkLogRedactionRules = compileNetworkLogRedaction({});
  private rulesVersion = 0;
  private rulesKey = JSON.stringify([[], []]);

  /**
   * Called with the full, redacted list of finished requests: at most every
   * 500 ms and only after a request finished (or the redaction changed).
   */
  setUpdatedCallback(
    updatedCallback: ((networkLogs: NetworkLogEntry[]) => void) | null
  ) {
    this.updatedCallback = updatedCallback;
    if (this.dirty) {
      this.schedulePush();
    }
  }

  /** The finished requests, oldest first, redacted and without blacklisted ones. */
  getRequests(): NetworkLogEntry[] {
    const networkLogs: NetworkLogEntry[] = [];
    for (const record of this.records) {
      if (!record.done) {
        continue;
      }
      let redacted = record.redacted;
      if (
        !redacted ||
        redacted.revision !== record.revision ||
        redacted.rulesVersion !== this.rulesVersion
      ) {
        let value: NetworkLogEntry | null = null;
        try {
          value = redactNetworkLogEntry(record.entry, this.rules);
        } catch (e) {
          // Never hand over an entry that could not be redacted.
          value = null;
        }
        redacted = {
          revision: record.revision,
          rulesVersion: this.rulesVersion,
          value,
        };
        record.redacted = redacted;
      }
      if (redacted.value) {
        networkLogs.push(redacted.value);
      }
    }
    return networkLogs;
  }

  setMaxRequests(maxRequests: number) {
    if (typeof maxRequests !== 'number' || !(maxRequests >= 1)) {
      return;
    }
    this.maxRequests = Math.min(Math.floor(maxRequests), MAX_REQUESTS_LIMIT);
    this.trimRecords();
  }

  setStopped(stopped: boolean) {
    this.stopped = !!stopped;
  }

  /** Local list from setNetworkLogPropsToIgnore; replaces the previous one. */
  setPropsToIgnore(propsToIgnore: unknown) {
    this.localPropsToIgnore = mergeNetworkLogLists(propsToIgnore);
    this.updateRules();
  }

  /** Local list from setNetworkLogsBlacklist; replaces the previous one. */
  setBlacklist(blacklist: unknown) {
    this.localBlacklist = mergeNetworkLogLists(blacklist);
    this.updateRules();
  }

  /** networkLogPropsToIgnore / networkLogBlacklist from the remote config. */
  setRemoteConfig(config: any) {
    try {
      if (!config || typeof config !== 'object') {
        return;
      }
      if (Array.isArray(config.networkLogPropsToIgnore)) {
        this.remotePropsToIgnore = mergeNetworkLogLists(
          config.networkLogPropsToIgnore
        );
      }
      if (Array.isArray(config.networkLogBlacklist)) {
        this.remoteBlacklist = mergeNetworkLogLists(config.networkLogBlacklist);
      }
      this.updateRules();
    } catch (e) {}
  }

  /** Pushes pending changes right away (e.g. before a silent crash report). */
  flush() {
    if (this.pushTimer !== null) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    if (!this.dirty || !this.updatedCallback) {
      return;
    }
    this.dirty = false;
    try {
      this.updatedCallback(this.getRequests());
    } catch (e) {}
  }

  start() {
    this.setStopped(false);
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    installXhrHooks(this);
    installFetchHook(this);
  }

  // Hook callbacks. They never throw into the app's networking code.

  handleXhrOpen(xhr: any, method: unknown, url: unknown) {
    try {
      let state = this.xhrStates.get(xhr);
      if (!state) {
        state = {
          method: '',
          url: '',
          headers: {},
          skip: false,
          record: null,
          failure: null,
          listening: false,
        };
        this.xhrStates.set(xhr, state);
      }
      state.method = normalizeMethod(method);
      state.url = normalizeUrl(url);
      state.headers = {};
      state.skip = this.fetchDepth > 0;
      state.record = null;
      state.failure = null;
    } catch (e) {}
  }

  handleXhrHeader(xhr: any, name: unknown, value: unknown) {
    try {
      const state = this.xhrStates.get(xhr);
      if (state && !state.skip) {
        addHeader(state.headers, name, value);
      }
    } catch (e) {}
  }

  handleXhrSend(xhr: any, body: unknown): LogRecord | null {
    try {
      const state = this.xhrStates.get(xhr);
      // No state: send() before open(). A record: sent twice. The native
      // send() throws in both cases.
      if (this.stopped || !state || state.skip || state.record) {
        return null;
      }
      if (!state.listening) {
        if (typeof xhr.addEventListener !== 'function') {
          return null;
        }
        state.listening = true;
        xhr.addEventListener('error', () =>
          this.handleXhrFailure(xhr, 'error')
        );
        xhr.addEventListener('timeout', () =>
          this.handleXhrFailure(xhr, 'timeout')
        );
        xhr.addEventListener('abort', () =>
          this.handleXhrFailure(xhr, 'abort')
        );
        xhr.addEventListener('loadend', () => this.handleXhrLoadEnd(xhr));
      }
      state.failure = null;
      state.record = this.createRecord(
        state.method,
        state.url,
        { ...state.headers },
        normalizeRequestBody(body, headerValue(state.headers, 'content-type'))
      );
      return state.record;
    } catch (e) {
      return null;
    }
  }

  handleXhrFailure(xhr: any, kind: 'error' | 'timeout' | 'abort') {
    try {
      const state = this.xhrStates.get(xhr);
      if (!state || !state.record) {
        return;
      }
      if (kind === 'abort') {
        state.failure = 'Request aborted';
      } else if (kind === 'timeout') {
        state.failure = 'Request timed out';
      } else {
        state.failure = readXhrErrorText(xhr) || 'Network request failed';
      }
    } catch (e) {}
  }

  handleXhrLoadEnd(xhr: any) {
    try {
      const state = this.xhrStates.get(xhr);
      const record = state ? state.record : null;
      if (!state || !record) {
        return;
      }
      state.record = null;
      if (this.stopped) {
        this.discard(record);
        return;
      }
      if (state.failure) {
        this.failRecord(record, state.failure);
        return;
      }
      let rawHeaders: unknown = null;
      try {
        rawHeaders = xhr.getAllResponseHeaders();
      } catch (e) {}
      const headers = parseRawHeaders(rawHeaders);
      let responseText = BODY_NOT_CAPTURED;
      try {
        responseText = readXhrBody(xhr, headerValue(headers, 'content-type'));
      } catch (e) {}
      this.completeRecord(record, {
        status: Number(xhr.status) || 0,
        statusText: String(xhr.statusText || ''),
        headers,
        responseText,
      });
    } catch (e) {}
  }

  handleFetchStart(args: any[]): LogRecord | null {
    try {
      if (this.stopped || !args || args.length === 0) {
        return null;
      }
      const input = args[0];
      const init = args[1] && typeof args[1] === 'object' ? args[1] : null;
      const request =
        input && typeof input === 'object' && typeof input.url === 'string'
          ? input
          : null;
      const headers = normalizeHeaders(
        init && init.headers !== undefined
          ? init.headers
          : request
          ? request.headers
          : undefined
      );
      const body =
        init && init.body !== undefined
          ? init.body
          : request
          ? request._bodyInit
          : undefined;
      return this.createRecord(
        normalizeMethod((init && init.method) || (request && request.method)),
        normalizeUrl(input),
        headers,
        normalizeRequestBody(body, headerValue(headers, 'content-type'))
      );
    } catch (e) {
      return null;
    }
  }

  handleFetchResponse(record: LogRecord, response: any) {
    try {
      if (record.done || record.evicted) {
        return;
      }
      if (this.stopped) {
        this.discard(record);
        return;
      }
      const headers = normalizeHeaders(response && response.headers);
      this.completeRecord(record, {
        status: Number(response && response.status) || 0,
        statusText: String((response && response.statusText) || ''),
        headers,
        responseText: BODY_PENDING,
      });
      this.readFetchBody(record, response, headers);
    } catch (e) {}
  }

  handleFetchError(record: LogRecord, error: unknown) {
    try {
      if (record.done || record.evicted) {
        return;
      }
      if (this.stopped) {
        this.discard(record);
        return;
      }
      this.failRecord(record, describeError(error));
    } catch (e) {}
  }

  private readFetchBody(
    record: LogRecord,
    response: any,
    headers: NetworkLogHeaders
  ) {
    const contentType = headerValue(headers, 'content-type');
    if (isStreamingContentType(contentType)) {
      this.setResponseBody(record, STREAMING_BODY);
      return;
    }
    if (contentType && !isTextContentType(contentType)) {
      this.setResponseBody(record, BINARY_BODY);
      return;
    }
    // Only read bodies of known small or unknown size; the text is capped.
    const contentLength = parseInt(headerValue(headers, 'content-length'), 10);
    if (
      contentLength > MAX_BODY_LENGTH ||
      !response ||
      typeof response.clone !== 'function'
    ) {
      this.setResponseBody(record, BODY_NOT_CAPTURED);
      return;
    }
    try {
      const clone = response.clone();
      // React Native's fetch holds the downloaded body in a Blob: without a
      // Content-Length, read only its head instead of the whole body.
      if (
        typeof clone.blob === 'function' &&
        typeof (global as any).FileReader === 'function'
      ) {
        Promise.resolve(clone.blob())
          .then((blob: any) => {
            const size = Number(blob && blob.size);
            if (
              !blob ||
              !Number.isFinite(size) ||
              size <= MAX_BODY_LENGTH ||
              typeof blob.slice !== 'function'
            ) {
              return readBlobAsText(blob).then((text) =>
                this.setResponseBody(record, captureText(text, contentType))
              );
            }
            return readBlobAsText(blob.slice(0, MAX_BODY_LENGTH)).then((text) =>
              this.setResponseBody(
                record,
                captureTextHead(text, contentType, size)
              )
            );
          })
          .catch(() => this.setResponseBody(record, BODY_NOT_CAPTURED));
        return;
      }
      Promise.resolve(clone.text()).then(
        (text: unknown) =>
          this.setResponseBody(record, captureText(text, contentType)),
        () => this.setResponseBody(record, BODY_NOT_CAPTURED)
      );
    } catch (e) {
      this.setResponseBody(record, BODY_NOT_CAPTURED);
    }
  }

  private setResponseBody(record: LogRecord, responseText: string) {
    try {
      if (!record.entry.response || record.evicted) {
        return;
      }
      record.entry.response.responseText = responseText;
      record.revision++;
      this.markChanged();
    } catch (e) {}
  }

  private createRecord(
    method: string,
    url: string,
    headers: NetworkLogHeaders,
    payload: string
  ): LogRecord {
    const startedAt = Date.now();
    const record: LogRecord = {
      startedAt,
      entry: {
        date: new Date(startedAt).toISOString(),
        type: method,
        url,
        duration: 0,
        success: false,
        request: { headers, payload },
      },
      done: false,
      evicted: false,
      revision: 0,
    };
    this.records.push(record);
    this.trimRecords();
    return record;
  }

  private completeRecord(
    record: LogRecord,
    response: NonNullable<NetworkLogEntry['response']>
  ) {
    if (record.evicted) {
      return;
    }
    record.done = true;
    record.entry.duration = Math.max(0, Date.now() - record.startedAt);
    record.entry.success = true;
    record.entry.response = response;
    record.revision++;
    this.markChanged();
  }

  private failRecord(record: LogRecord, errorText: string) {
    if (record.evicted) {
      return;
    }
    record.done = true;
    record.entry.duration = Math.max(0, Date.now() - record.startedAt);
    record.entry.success = false;
    record.entry.response = { errorText };
    record.revision++;
    this.markChanged();
  }

  discard(record: LogRecord | null) {
    if (!record) {
      return;
    }
    record.evicted = true;
    const index = this.records.indexOf(record);
    if (index !== -1) {
      this.records.splice(index, 1);
    }
  }

  private trimRecords() {
    while (this.records.length > this.maxRequests) {
      const removed = this.records.shift();
      if (removed) {
        removed.evicted = true;
      }
    }
  }

  private updateRules() {
    const propsToIgnore = mergeNetworkLogLists(
      this.remotePropsToIgnore,
      this.localPropsToIgnore
    );
    const blacklist = mergeNetworkLogLists(
      this.remoteBlacklist,
      this.localBlacklist
    );
    // Config reloads resend the same lists: no re-redaction, no push.
    const key = JSON.stringify([propsToIgnore, blacklist]);
    if (key === this.rulesKey) {
      return;
    }
    this.rulesKey = key;
    this.rules = compileNetworkLogRedaction({ propsToIgnore, blacklist });
    this.rulesVersion++;
    if (this.records.some((record) => record.done)) {
      this.markChanged();
    }
  }

  private markChanged() {
    this.dirty = true;
    this.schedulePush();
  }

  // Trailing push, at most one pending: bursts of requests become one push.
  private schedulePush() {
    if (this.pushTimer !== null || !this.updatedCallback) {
      return;
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.flush();
    }, PUSH_DELAY_MS);
  }
}

function installXhrHooks(logger: GleapNetworkIntercepter) {
  const XHR = (global as any).XMLHttpRequest;
  const proto = XHR && XHR.prototype;
  if (
    !proto ||
    typeof proto.open !== 'function' ||
    typeof proto.send !== 'function'
  ) {
    return;
  }
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const originalSetRequestHeader = proto.setRequestHeader;

  proto.open = function (this: any, ...args: any[]) {
    const result = originalOpen.apply(this, args);
    logger.handleXhrOpen(this, args[0], args[1]);
    return result;
  };

  if (typeof originalSetRequestHeader === 'function') {
    // Always forwards the header; logging never changes the request.
    proto.setRequestHeader = function (this: any, ...args: any[]) {
      const result = originalSetRequestHeader.apply(this, args);
      logger.handleXhrHeader(this, args[0], args[1]);
      return result;
    };
  }

  proto.send = function (this: any, ...args: any[]) {
    const record = logger.handleXhrSend(this, args[0]);
    try {
      return originalSend.apply(this, args);
    } catch (error) {
      logger.discard(record);
      throw error;
    }
  };
}

function installFetchHook(logger: GleapNetworkIntercepter) {
  const target = global as any;
  const originalFetch = target.fetch;
  if (typeof originalFetch !== 'function') {
    return;
  }

  target.fetch = function (this: any, ...args: any[]) {
    const record = logger.handleFetchStart(args);
    let result: any;
    logger.fetchDepth++;
    try {
      result = originalFetch.apply(this, args);
    } catch (error) {
      if (record) {
        logger.handleFetchError(record, error);
      }
      throw error;
    } finally {
      logger.fetchDepth--;
    }

    if (!record) {
      return result;
    }
    if (!result || typeof result.then !== 'function') {
      logger.discard(record);
      return result;
    }
    return result.then(
      (response: any) => {
        logger.handleFetchResponse(record, response);
        return response;
      },
      (error: any) => {
        logger.handleFetchError(record, error);
        throw error;
      }
    );
  };
}

export default GleapNetworkIntercepter;
