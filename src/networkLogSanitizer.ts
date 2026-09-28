/**
 * Redaction for network log entries before they are handed to the native
 * SDK. Pure functions without React Native imports, so they can be unit
 * tested. The native SDKs redact again when a report is built; this is the
 * first line of defense.
 */

export const REDACTED_VALUE = '[REDACTED]';
export const BINARY_BODY = '[binary body omitted]';
export const STREAMING_BODY = '[streaming body omitted]';
export const BODY_NOT_CAPTURED = '[body not captured]';
export const BODY_PENDING = '[body pending]';

export const DEFAULT_NETWORK_LOG_BLACKLIST: ReadonlyArray<string> = [
  'gleap.io',
  'gleap.ai',
];

// Credential headers are always masked (value replaced, key kept).
const MASKED_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
];

export type NetworkLogHeaders = { [name: string]: string };

export type NetworkLogEntry = {
  date?: string;
  type?: string;
  url?: string;
  duration?: number;
  success?: boolean;
  request?: {
    headers?: NetworkLogHeaders;
    payload?: string;
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: NetworkLogHeaders;
    responseText?: string;
    errorText?: string;
  };
};

export type NetworkLogRedactionConfig = {
  propsToIgnore?: ReadonlyArray<unknown> | null;
  blacklist?: ReadonlyArray<unknown> | null;
};

export type NetworkLogRedactionRules = {
  // Lower-cased prop names, matched as whole keys / header names / params.
  props: Set<string>;
  // Lower-cased segments of props containing a dot, applied from the root.
  paths: string[][];
  // Substrings; an entry whose url contains one is dropped.
  blacklist: string[];
};

/**
 * Merges string lists into one: trims, drops empty strings and non-strings,
 * removes duplicates. Anything that is not an array is ignored.
 */
export function mergeNetworkLogLists(...lists: unknown[]): string[] {
  const result: string[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const item of list) {
      if (typeof item !== 'string') {
        continue;
      }
      const value = item.trim();
      if (value.length > 0 && result.indexOf(value) === -1) {
        result.push(value);
      }
    }
  }
  return result;
}

export function compileNetworkLogRedaction(
  config: NetworkLogRedactionConfig
): NetworkLogRedactionRules {
  const props = new Set<string>();
  const paths: string[][] = [];
  for (const prop of mergeNetworkLogLists(config.propsToIgnore)) {
    const lower = prop.toLowerCase();
    if (props.has(lower)) {
      continue;
    }
    props.add(lower);
    if (lower.indexOf('.') !== -1) {
      const segments = lower.split('.');
      if (segments.every((segment) => segment.length > 0)) {
        paths.push(segments);
      }
    }
  }

  return {
    props,
    paths,
    blacklist: mergeNetworkLogLists(
      DEFAULT_NETWORK_LOG_BLACKLIST,
      config.blacklist
    ),
  };
}

export function isNetworkLogUrlBlacklisted(
  url: unknown,
  blacklist: ReadonlyArray<string>
): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  for (const entry of blacklist) {
    if (entry && url.indexOf(entry) !== -1) {
      return true;
    }
  }
  return false;
}

function headerValueToString(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }
  return String(value);
}

export function redactNetworkLogHeaders(
  headers: unknown,
  rules: NetworkLogRedactionRules
): NetworkLogHeaders {
  const result: NetworkLogHeaders = {};
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return result;
  }
  const source = headers as { [name: string]: unknown };
  for (const name of Object.keys(source)) {
    const lower = name.toLowerCase();
    if (rules.props.has(lower)) {
      continue;
    }
    result[name] =
      MASKED_HEADERS.indexOf(lower) !== -1
        ? REDACTED_VALUE
        : headerValueToString(source[name]);
  }
  return result;
}

function findHeader(headers: unknown, name: string): string {
  if (!headers || typeof headers !== 'object') {
    return '';
  }
  const source = headers as { [name: string]: unknown };
  for (const key of Object.keys(source)) {
    if (key.toLowerCase() === name) {
      return headerValueToString(source[key]);
    }
  }
  return '';
}

function removeKeysDeep(node: unknown, props: Set<string>): boolean {
  let changed = false;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (removeKeysDeep(item, props)) {
        changed = true;
      }
    }
  } else if (node && typeof node === 'object') {
    const object = node as { [key: string]: unknown };
    for (const key of Object.keys(object)) {
      if (props.has(key.toLowerCase())) {
        delete object[key];
        changed = true;
      } else if (removeKeysDeep(object[key], props)) {
        changed = true;
      }
    }
  }
  return changed;
}

// Removes a dotted path (`user.password`) from the root. Arrays on the way
// are walked through, so the path applies to every element.
function removePath(node: unknown, segments: string[], index: number): boolean {
  let changed = false;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (removePath(item, segments, index)) {
        changed = true;
      }
    }
    return changed;
  }
  if (!node || typeof node !== 'object') {
    return false;
  }
  const object = node as { [key: string]: unknown };
  const isLast = index === segments.length - 1;
  for (const key of Object.keys(object)) {
    if (key.toLowerCase() !== segments[index]) {
      continue;
    }
    if (isLast) {
      delete object[key];
      changed = true;
    } else if (removePath(object[key], segments, index + 1)) {
      changed = true;
    }
  }
  return changed;
}

function looksLikeJson(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      continue;
    }
    return char === '{' || char === '[';
  }
  return false;
}

// Returns the redacted JSON text (the original string when nothing was
// removed), or null when the text does not parse.
function redactJsonText(
  text: string,
  rules: NetworkLogRedactionRules
): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return null;
  }

  let changed = removeKeysDeep(parsed, rules.props);
  for (const path of rules.paths) {
    if (removePath(parsed, path, 0)) {
      changed = true;
    }
  }
  return changed ? JSON.stringify(parsed) : text;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TRUNCATION_MARKER = /\n… \[truncated, [^\]\n]*\]$/;

// JSON that does not parse, usually because it was cut at the size limit:
// mask the values of ignored keys in the text instead of handing the head
// over as is. Object and array values are left alone; their inner keys are
// matched on their own.
function maskJsonText(text: string, rules: NetworkLogRedactionRules): string {
  const keys = new Set<string>();
  rules.props.forEach((prop) => {
    keys.add(prop);
    const lastDot = prop.lastIndexOf('.');
    if (lastDot !== -1 && lastDot < prop.length - 1) {
      keys.add(prop.slice(lastDot + 1));
    }
  });

  // Keep the truncation marker out of reach of a string value cut at the end.
  const marker = TRUNCATION_MARKER.exec(text);
  let body = marker ? text.slice(0, marker.index) : text;
  keys.forEach((key) => {
    const pattern = new RegExp(
      '"(' +
        escapeRegExp(key) +
        ')"(\\s*:\\s*)("(?:[^"\\\\]|\\\\.)*"?|-?\\d[0-9.eE+-]*|true|false|null)',
      'gi'
    );
    body = body.replace(pattern, '"$1"$2"' + REDACTED_VALUE + '"');
  });
  const masked = marker ? body + marker[0] : body;
  return masked === text ? text : masked;
}

function decodeParamName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch (e) {
    return raw;
  }
}

// Removes `name=value` pairs whose (decoded) name is a prop. Returns null when
// nothing was removed; the kept pairs are not re-encoded.
function removeParams(query: string, props: Set<string>): string | null {
  const kept: string[] = [];
  let changed = false;
  for (const part of query.split('&')) {
    const separator = part.indexOf('=');
    const rawName = separator === -1 ? part : part.slice(0, separator);
    if (rawName && props.has(decodeParamName(rawName).toLowerCase())) {
      changed = true;
      continue;
    }
    kept.push(part);
  }
  return changed ? kept.join('&') : null;
}

function looksUrlEncoded(text: string): boolean {
  return text.indexOf('=') > 0 && !/\s/.test(text) && !/^[[{<"]/.test(text);
}

export function redactNetworkLogUrl(
  url: string,
  rules: NetworkLogRedactionRules
): string {
  if (rules.props.size === 0) {
    return url;
  }
  const queryStart = url.indexOf('?');
  if (queryStart === -1) {
    return url;
  }
  const hashStart = url.indexOf('#', queryStart);
  const query =
    hashStart === -1
      ? url.slice(queryStart + 1)
      : url.slice(queryStart + 1, hashStart);
  const fragment = hashStart === -1 ? '' : url.slice(hashStart);
  const redacted = removeParams(query, rules.props);
  if (redacted === null) {
    return url;
  }
  return url.slice(0, queryStart) + (redacted ? '?' + redacted : '') + fragment;
}

/**
 * Removes props from a request payload or response text. JSON bodies lose
 * matching keys at any depth (and dotted paths from the root), form bodies
 * lose matching params. A body that does not parse, or is not changed, is
 * returned untouched.
 */
export function redactNetworkLogBody(
  body: unknown,
  contentType: string,
  rules: NetworkLogRedactionRules
): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  let text: string;
  if (typeof body === 'string') {
    text = body;
  } else if (typeof body === 'object') {
    try {
      text = JSON.stringify(body);
    } catch (e) {
      return BODY_NOT_CAPTURED;
    }
  } else {
    text = String(body);
  }

  if (rules.props.size === 0 || text.length === 0) {
    return text;
  }

  try {
    if (looksLikeJson(text)) {
      const redacted = redactJsonText(text, rules);
      return redacted === null ? maskJsonText(text, rules) : redacted;
    }

    const type = contentType.toLowerCase();
    if (
      type.indexOf('x-www-form-urlencoded') !== -1 ||
      (!type && looksUrlEncoded(text))
    ) {
      const redacted = removeParams(text, rules.props);
      return redacted === null ? text : redacted;
    }
  } catch (e) {
    // Fail closed: never hand over a body we could not redact.
    return BODY_NOT_CAPTURED;
  }

  return text;
}

/**
 * Returns a redacted copy of the entry, or null if the entry is blacklisted.
 * The input entry is never modified.
 */
export function redactNetworkLogEntry(
  entry: NetworkLogEntry,
  rules: NetworkLogRedactionRules
): NetworkLogEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  if (isNetworkLogUrlBlacklisted(entry.url, rules.blacklist)) {
    return null;
  }

  const result: NetworkLogEntry = { ...entry };
  if (typeof entry.url === 'string') {
    result.url = redactNetworkLogUrl(entry.url, rules);
  }

  if (entry.request && typeof entry.request === 'object') {
    const request = { ...entry.request };
    if (entry.request.headers !== undefined) {
      request.headers = redactNetworkLogHeaders(entry.request.headers, rules);
    }
    if (entry.request.payload !== undefined) {
      request.payload = redactNetworkLogBody(
        entry.request.payload,
        findHeader(entry.request.headers, 'content-type'),
        rules
      );
    }
    result.request = request;
  }

  if (entry.response && typeof entry.response === 'object') {
    const response = { ...entry.response };
    if (entry.response.headers !== undefined) {
      response.headers = redactNetworkLogHeaders(entry.response.headers, rules);
    }
    if (entry.response.responseText !== undefined) {
      response.responseText = redactNetworkLogBody(
        entry.response.responseText,
        findHeader(entry.response.headers, 'content-type'),
        rules
      );
    }
    result.response = response;
  }

  return result;
}

export function redactNetworkLogs(
  entries: ReadonlyArray<NetworkLogEntry>,
  config: NetworkLogRedactionConfig
): NetworkLogEntry[] {
  const rules = compileNetworkLogRedaction(config);
  const result: NetworkLogEntry[] = [];
  for (const entry of entries) {
    const redacted = redactNetworkLogEntry(entry, rules);
    if (redacted) {
      result.push(redacted);
    }
  }
  return result;
}
