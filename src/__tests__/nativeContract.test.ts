// The JS API, the iOS module and the Android module are three hand-written lists of the same methods and events.
// Nothing compiles them against each other: a method that exists on one side only fails in a customer's app, at
// runtime. These tests read the three sources and compare them.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const JS_SOURCE = read('src/index.tsx');
const ANDROID_SOURCE = read(
  'android/src/main/java/com/reactnativegleapsdk/GleapsdkModule.java'
);
const IOS_SOURCE = read('ios/Gleapsdk.m');

// Block comments and whole-line comments, so that a commented-out export does not count.
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const matchesOf = (source: string, pattern: RegExp) =>
  new Set(Array.from(source.matchAll(pattern), (match) => match[1] ?? ''));

const sorted = (names: Iterable<string>) => Array.from(names).sort();

const difference = (left: Set<string>, right: Set<string>) =>
  sorted(Array.from(left).filter((name) => !right.has(name)));

// The methods of `type GleapSdkType`, what customers call.
const publicMethods = () => {
  const block = JS_SOURCE.match(/^type GleapSdkType = \{([\s\S]*?)^\};/m);
  return matchesOf(block?.[1] ?? '', /^ {2}(\w+)\(/gm);
};

// Methods src/index.tsx defines on the module object itself.
const jsMethods = () => matchesOf(JS_SOURCE, /^\s*GleapSdk\.(\w+) = /gm);

// A @ReactMethod, other annotations, then the declaration.
const androidMethods = () =>
  matchesOf(
    withoutComments(ANDROID_SOURCE),
    /@ReactMethod(?:\([^)]*\))?\s+(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|synchronized)\s+)*[\w<>[\],\s]+?\s+(\w+)\s*\(/g
  );

// RCT_EXPORT_METHOD(name:...) and RCT_REMAP_METHOD(jsName, ...).
const iosMethods = () => {
  const source = withoutComments(IOS_SOURCE);
  return new Set([
    ...matchesOf(source, /RCT_EXPORT_(?:\w+_)?METHOD\(\s*(\w+)/g),
    ...matchesOf(source, /RCT_REMAP_(?:\w+_)?METHOD\(\s*(\w+)\s*,/g),
  ]);
};

const jsListenedEvents = () =>
  matchesOf(JS_SOURCE, /gleapEmitter\.addListener\(\s*'(\w+)'/g);

const androidEvents = () =>
  matchesOf(
    withoutComments(ANDROID_SOURCE),
    /(?:\.emit|emitToJs)\(\s*"(\w+)"/g
  );

const iosSentEvents = () =>
  matchesOf(withoutComments(IOS_SOURCE), /sendEventWithName:\s*@"(\w+)"/g);

const iosSupportedEvents = () => {
  const body = withoutComments(IOS_SOURCE).match(
    /supportedEvents\s*\{([\s\S]*?)\}/
  );
  return matchesOf(body?.[1] ?? '', /@"(\w+)"/g);
};

// Exported by one platform only, on purpose. Adding to these lists is a decision: say why next to the name.
const ANDROID_ONLY_METHODS = [
  // NativeEventEmitter calls them on Android; iOS gets them from RCTEventEmitter.
  'addListener',
  'removeListeners',
  // The JS network log hands its requests to the Android SDK (iOS logs natively).
  'logsFlushed',
  'registerLogFlushHandler',
];
const IOS_ONLY_METHODS = [
  // iOS records requests natively; src/index.tsx checks that they exist before calling them.
  'startNetworkRecording',
  'stopNetworkRecording',
];
// Sent by one platform only. The JS listener is registered on both.
const ANDROID_ONLY_EVENTS = ['flushLogs'];

describe('native contract: the sources are read', () => {
  it('finds the methods and events on every side', () => {
    expect(publicMethods().size).toBeGreaterThan(50);
    expect(androidMethods().size).toBeGreaterThan(50);
    expect(iosMethods().size).toBeGreaterThan(50);
    expect(jsListenedEvents().size).toBeGreaterThan(10);
    expect(iosSupportedEvents().size).toBeGreaterThan(10);
  });
});

describe('native contract: methods', () => {
  it('every public method is defined in JS or exported on both platforms', () => {
    const android = androidMethods();
    const ios = iosMethods();
    const js = jsMethods();
    const missing = sorted(publicMethods()).filter(
      (name) => !js.has(name) && !(android.has(name) && ios.has(name))
    );
    expect(missing).toEqual([]);
  });

  it('a method exported on one platform only is one of the known ones', () => {
    expect(difference(androidMethods(), iosMethods())).toEqual(
      sorted(ANDROID_ONLY_METHODS)
    );
    expect(difference(iosMethods(), androidMethods())).toEqual(
      sorted(IOS_ONLY_METHODS)
    );
  });
});

describe('native contract: events', () => {
  it('iOS lists every event it sends in supportedEvents', () => {
    expect(difference(iosSentEvents(), iosSupportedEvents())).toEqual([]);
  });

  it('every event JS listens to is sent by both platforms, or is a known one-platform event', () => {
    const android = androidEvents();
    const ios = iosSentEvents();
    const known = new Set(ANDROID_ONLY_EVENTS);
    const unsent = sorted(jsListenedEvents()).filter(
      (name) =>
        !(android.has(name) && ios.has(name)) &&
        !(known.has(name) && android.has(name))
    );
    expect(unsent).toEqual([]);
  });

  it('every event a platform sends has a JS listener', () => {
    const listened = jsListenedEvents();
    expect(difference(androidEvents(), listened)).toEqual([]);
    expect(difference(iosSentEvents(), listened)).toEqual([]);
  });
});
