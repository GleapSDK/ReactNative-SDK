import {
  BODY_NOT_CAPTURED,
  REDACTED_VALUE,
  compileNetworkLogRedaction,
  mergeNetworkLogLists,
  redactNetworkLogs,
} from '../networkLogSanitizer';
import type { NetworkLogEntry } from '../networkLogSanitizer';

const entry = (overrides: Partial<NetworkLogEntry> = {}): NetworkLogEntry => ({
  date: '2026-09-27T10:00:00.123Z',
  type: 'POST',
  url: 'https://api.example.com/login',
  duration: 12,
  success: true,
  request: { headers: {}, payload: '' },
  response: { status: 200, statusText: 'OK', headers: {}, responseText: '' },
  ...overrides,
});

const redactOne = (
  item: NetworkLogEntry,
  propsToIgnore: string[] = [],
  blacklist: string[] = []
): NetworkLogEntry => {
  const result = redactNetworkLogs([item], { propsToIgnore, blacklist });
  expect(result).toHaveLength(1);
  return result[0] as NetworkLogEntry;
};

describe('blacklist', () => {
  it('always drops gleap.io and gleap.ai requests', () => {
    const result = redactNetworkLogs(
      [
        entry({ url: 'https://api.gleap.io/v3/session' }),
        entry({ url: 'https://ws.gleap.ai/' }),
        entry({ url: 'https://api.example.com/items' }),
      ],
      {}
    );
    expect(result.map((item) => item.url)).toEqual([
      'https://api.example.com/items',
    ]);
  });

  it('drops urls containing a configured entry', () => {
    const result = redactNetworkLogs(
      [
        entry({ url: 'https://analytics.example.com/track' }),
        entry({ url: 'https://api.example.com/items' }),
      ],
      { blacklist: ['analytics.example'] }
    );
    expect(result.map((item) => item.url)).toEqual([
      'https://api.example.com/items',
    ]);
  });

  it('ignores empty entries instead of dropping every request', () => {
    const result = redactNetworkLogs([entry()], { blacklist: ['', '   '] });
    expect(result).toHaveLength(1);
  });
});

describe('headers', () => {
  it('removes headers named like a prop, case-insensitively, in request and response', () => {
    const result = redactOne(
      entry({
        request: {
          headers: { 'X-Api-Key': 'secret', 'Accept': 'application/json' },
          payload: '',
        },
        response: {
          status: 200,
          headers: { 'x-api-key': 'secret', 'Content-Type': 'text/plain' },
          responseText: 'ok',
        },
      }),
      ['X-API-KEY']
    );
    expect(result.request?.headers).toEqual({ Accept: 'application/json' });
    expect(result.response?.headers).toEqual({ 'Content-Type': 'text/plain' });
  });

  it('always masks credential headers and keeps their keys', () => {
    const result = redactOne(
      entry({
        request: {
          headers: {
            'Authorization': 'Bearer abc',
            'PROXY-AUTHORIZATION': 'Basic xyz',
            'cookie': 'session=1',
            'Accept': 'application/json',
          },
          payload: '',
        },
        response: {
          status: 200,
          headers: { 'Set-Cookie': 'session=2' },
          responseText: '',
        },
      })
    );
    expect(result.request?.headers).toEqual({
      'Authorization': REDACTED_VALUE,
      'PROXY-AUTHORIZATION': REDACTED_VALUE,
      'cookie': REDACTED_VALUE,
      'Accept': 'application/json',
    });
    expect(result.response?.headers).toEqual({ 'Set-Cookie': REDACTED_VALUE });
  });

  it('removes a credential header entirely when it is a prop', () => {
    const result = redactOne(
      entry({
        request: { headers: { Authorization: 'Bearer abc' }, payload: '' },
      }),
      ['authorization']
    );
    expect(result.request?.headers).toEqual({});
  });
});

describe('JSON bodies', () => {
  it('removes matching keys at any depth, inside arrays too, case-insensitively', () => {
    const payload = JSON.stringify({
      Password: 'a',
      user: { name: 'n', password: 'b' },
      items: [{ PASSWORD: 'c', id: 1 }, [{ password: 'd' }]],
    });
    const responseText = JSON.stringify([{ token: 't', ok: true }]);
    const result = redactOne(
      entry({
        request: { headers: {}, payload },
        response: { status: 200, headers: {}, responseText },
      }),
      ['password', 'TOKEN']
    );
    expect(result.request?.payload).toBe(
      '{"user":{"name":"n"},"items":[{"id":1},[{}]]}'
    );
    expect(result.response?.responseText).toBe('[{"ok":true}]');
  });

  it('treats a dotted prop as a path from the root and as a whole key', () => {
    const payload = JSON.stringify({
      User: { Password: 'a', name: 'n' },
      other: { user: { password: 'kept' } },
      nested: { 'user.password': 'b' },
      list: [{ user: { password: 'kept' } }],
    });
    const result = redactOne(entry({ request: { headers: {}, payload } }), [
      'user.password',
    ]);
    expect(JSON.parse(result.request?.payload as string)).toEqual({
      User: { name: 'n' },
      other: { user: { password: 'kept' } },
      nested: {},
      list: [{ user: { password: 'kept' } }],
    });
  });

  it('applies a dotted path to every element of a root array', () => {
    const payload = JSON.stringify([
      { user: { password: 'a', id: 1 } },
      { user: { password: 'b', id: 2 } },
    ]);
    const result = redactOne(entry({ request: { headers: {}, payload } }), [
      'user.password',
    ]);
    expect(result.request?.payload).toBe(
      '[{"user":{"id":1}},{"user":{"id":2}}]'
    );
  });

  it('returns the original string when nothing is removed', () => {
    const payload = '{\n  "id": 12345678901234567890,\n  "name": "n"\n}';
    const result = redactOne(entry({ request: { headers: {}, payload } }), [
      'password',
    ]);
    expect(result.request?.payload).toBe(payload);
  });

  it('leaves bodies that do not parse and hold no ignored key untouched', () => {
    const truncated = '{"id":1,"items":[1,2\n… [truncated, 200000 bytes]';
    const result = redactOne(
      entry({
        request: { headers: {}, payload: truncated },
        response: {
          status: 200,
          headers: {},
          responseText: '[binary body omitted]',
        },
      }),
      ['password']
    );
    expect(result.request?.payload).toBe(truncated);
    expect(result.response?.responseText).toBe('[binary body omitted]');
  });

  it('masks ignored keys in JSON bodies that were cut at the size limit', () => {
    const marker = '\n… [truncated, 200000 bytes]';
    const result = redactOne(
      entry({
        request: {
          headers: {},
          payload:
            '{"user":{"password":"pw-0","name":"n"},"token":"abc","items":[{"Token":"x"' +
            marker,
        },
        response: {
          status: 200,
          headers: {},
          responseText: '[{"id":1,"password": 42},{"password":"pw-cut' + marker,
        },
      }),
      ['password', 'token']
    );
    expect(result.request?.payload).toBe(
      '{"user":{"password":"[REDACTED]","name":"n"},"token":"[REDACTED]","items":[{"Token":"[REDACTED]"' +
        marker
    );
    expect(result.response?.responseText).toBe(
      '[{"id":1,"password": "[REDACTED]"},{"password":"[REDACTED]"' + marker
    );
  });

  it('serialises a non-string body before redacting it', () => {
    const result = redactOne(
      entry({
        request: {
          headers: {},
          payload: { password: 'a', id: 1 } as unknown as string,
        },
      }),
      ['password']
    );
    expect(result.request?.payload).toBe('{"id":1}');
  });

  it('fails closed when a parsed body is too deep to walk', () => {
    // JSON.parse copes with this depth, the recursive key removal does not.
    let deep = '"x"';
    for (let i = 0; i < 100000; i++) {
      deep = '[' + deep + ']';
    }
    const payload = '{"deep":' + deep + ',"password":"a"}';
    const result = redactOne(entry({ request: { headers: {}, payload } }), [
      'password',
    ]);
    expect(result.request?.payload).toBe(BODY_NOT_CAPTURED);
  });
});

describe('form bodies and query parameters', () => {
  it('removes form params named like a prop, case-insensitively', () => {
    const result = redactOne(
      entry({
        request: {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          payload: 'user=a%20b&PassWord=secret&pass%77ord=x&keep=1',
        },
      }),
      ['password']
    );
    expect(result.request?.payload).toBe('user=a%20b&keep=1');
  });

  it('treats a text body without content type as form data', () => {
    const result = redactOne(
      entry({ request: { headers: {}, payload: 'token=abc&page=2' } }),
      ['token']
    );
    expect(result.request?.payload).toBe('page=2');
  });

  it('leaves other text bodies alone', () => {
    const payload = 'token=abc is not a form';
    const result = redactOne(
      entry({
        request: { headers: { 'content-type': 'text/plain' }, payload },
      }),
      ['token']
    );
    expect(result.request?.payload).toBe(payload);
  });

  it('removes query params from the url and keeps the fragment', () => {
    expect(
      redactOne(
        entry({ url: 'https://api.example.com/a?Token=1&page=2#top' }),
        ['token']
      ).url
    ).toBe('https://api.example.com/a?page=2#top');
    expect(
      redactOne(entry({ url: 'https://api.example.com/a?token=1' }), ['TOKEN'])
        .url
    ).toBe('https://api.example.com/a');
    expect(
      redactOne(entry({ url: 'https://api.example.com/a?page=2' }), ['token'])
        .url
    ).toBe('https://api.example.com/a?page=2');
  });
});

describe('entries', () => {
  it('does not modify the input entries', () => {
    const input = entry({
      url: 'https://api.example.com/a?token=1',
      request: {
        headers: { Authorization: 'Bearer abc' },
        payload: '{"password":"a"}',
      },
      response: { errorText: 'Network request failed' },
      success: false,
    });
    const copy = JSON.parse(JSON.stringify(input));
    const result = redactOne(input, ['token', 'password']);
    expect(input).toEqual(copy);
    expect(result).toEqual({
      ...copy,
      url: 'https://api.example.com/a',
      request: { headers: { Authorization: REDACTED_VALUE }, payload: '{}' },
      response: { errorText: 'Network request failed' },
    });
  });
});

describe('lists', () => {
  it('merges lists without duplicates, empty strings or non-strings', () => {
    expect(
      mergeNetworkLogLists(
        ['a', ' b ', '', 5, null],
        ['a', 'c'],
        'not a list',
        undefined
      )
    ).toEqual(['a', 'b', 'c']);
  });

  it('matches props case-insensitively and keeps the default blacklist', () => {
    const rules = compileNetworkLogRedaction({
      propsToIgnore: ['Password', 'password', 'user.Token', 'a..b'],
      blacklist: ['example.com'],
    });
    expect(Array.from(rules.props)).toEqual(['password', 'user.token', 'a..b']);
    expect(rules.paths).toEqual([['user', 'token']]);
    expect(rules.blacklist).toEqual(['gleap.io', 'gleap.ai', 'example.com']);
  });
});
