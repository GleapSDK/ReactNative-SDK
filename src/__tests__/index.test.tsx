// The native module replays the loaded config when initialize is called again
// (JS reload, SDK already initialized natively). On Android the JS network
// logger depends on it, and handles it once per JS context.

type Listener = (data?: any) => void;

const loadSdk = (os: 'android' | 'ios') => {
  const listeners: { [eventType: string]: Listener } = {};
  const store: { [name: string]: any } = {};
  const nativeModule = new Proxy(store, {
    get(target, name: string) {
      if (!(name in target) && name !== 'touched') {
        target[name] = jest.fn();
      }
      return target[name];
    },
  });

  jest.doMock('react-native', () => ({
    NativeModules: { Gleapsdk: nativeModule },
    NativeEventEmitter: class {
      addListener(eventType: string, listener: Listener) {
        listeners[eventType] = listener;
      }
    },
    Platform: {
      OS: os,
      select: (options: any) => options[os] ?? options.default,
    },
  }));

  let sdk: any;
  jest.isolateModules(() => {
    sdk = require('../index').default;
  });
  return {
    sdk,
    emit: (eventType: string, data?: any) => listeners[eventType]?.(data),
  };
};

const config = JSON.stringify({
  enableNetworkLogs: true,
  networkLogPropsToIgnore: ['token'],
});

describe('configLoaded on Android', () => {
  const originalFetch = (global as any).fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterAll(() => {
    (global as any).fetch = originalFetch;
  });

  it('starts the network logger from a replayed config', () => {
    const { emit } = loadSdk('android');
    expect((global as any).fetch).toBe(fetchMock);

    emit('configLoaded', config);

    expect((global as any).fetch).not.toBe(fetchMock);
  });

  it('handles a config that arrives twice once', () => {
    const { sdk, emit } = loadSdk('android');
    const onConfigLoaded = jest.fn();
    const onInitialized = jest.fn();
    sdk.registerListener('configLoaded', onConfigLoaded);
    sdk.registerListener('initialized', onInitialized);

    emit('configLoaded', config);
    emit('initialized');
    const hookedFetch = (global as any).fetch;
    emit('configLoaded', config);
    emit('initialized');

    expect((global as any).fetch).toBe(hookedFetch);
    expect(onConfigLoaded).toHaveBeenCalledTimes(1);
    expect(onInitialized).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicit stopNetworkLogging() over a replayed config', () => {
    const { sdk, emit } = loadSdk('android');
    sdk.stopNetworkLogging();

    emit('configLoaded', config);

    expect((global as any).fetch).toBe(fetchMock);
  });

  it('does not start the logger when the config disables network logs', () => {
    const { emit } = loadSdk('android');

    emit('configLoaded', JSON.stringify({ enableNetworkLogs: false }));

    expect((global as any).fetch).toBe(fetchMock);
  });
});

describe('configLoaded on iOS', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('notifies every configLoaded and leaves network logging to the native SDK', () => {
    const fetchMock = jest.fn();
    const originalFetch = (global as any).fetch;
    (global as any).fetch = fetchMock;
    try {
      const { sdk, emit } = loadSdk('ios');
      const onConfigLoaded = jest.fn();
      sdk.registerListener('configLoaded', onConfigLoaded);

      emit('configLoaded', config);
      emit('configLoaded', config);

      expect(onConfigLoaded).toHaveBeenCalledTimes(2);
      expect((global as any).fetch).toBe(fetchMock);
    } finally {
      (global as any).fetch = originalFetch;
    }
  });
});
