// The React Native SDK half of the quality check: limits, scope and names from .claude/rules/code-conventions.md. The
// other .mjs files in this folder are the core shared with the other Gleap repos; change them there first (core.sha256).
// The core parses with the TypeScript in ./node_modules (package.json here), not the root's, which builds the package.
import { basename } from 'node:path';

export const LIMITS = {
  // A new file over fileLines is a warning, over newFileLines an error. An existing file over fileLines may not grow.
  fileLines: 400,
  newFileLines: 700,
  functionLines: 80,
  componentLines: 150,
  jsxReturnLines: 60,
  positionalParams: 2,
  // Growth up to this in a file or function already over its limit is a note, not a failure.
  smallGrowthLines: 10,
  lineChars: 160,
  // This share of a new file found in what the change removed elsewhere makes it moved code.
  movedShare: 0.9,
  // This share of a file in literal tables makes it data, with no line limit.
  dataShare: 0.9,
  dataMinLines: 50,
};

const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/;
// Tests, fixtures and mocks live in these folders: bob does not build them and package.json `files` leaves them out.
const OUT_OF_SCOPE = [/(^|\/)(__tests__|__fixtures__|__mocks__)\//, /\.(test|spec)\.[cm]?[jt]sx?$/, /\.d\.[cm]?ts$/, /\.generated\.[cm]?[jt]sx?$/];
const FIXTURE = [/(^|\/)fixtures\//, /\.fixtures?\.[cm]?[jt]sx?$/];

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;

// Components are PascalCase (GleapBannerArea.tsx), everything else camelCase (networkLogSanitizer.ts).
const fileNameProblem = ({ path, facts }) => {
  const name = basename(path).replace(SOURCE_EXTENSION, '');
  if (facts.definesComponent) {
    return PASCAL_CASE.test(name) ? null : 'a component file is PascalCase, like GleapBannerArea.tsx';
  }
  return CAMEL_CASE.test(name) ? null : 'a module file is camelCase and names what it holds, like networkLogSanitizer.ts';
};

const folderNameProblem = (folder) => (CAMEL_CASE.test(basename(folder)) ? null : 'a new folder in src is camelCase');

// No needs-test here. The core looks for a test whose path starts with the file's own (src/x.test.ts), and such a file
// would ship: package.json `files` publishes src and leaves out only __tests__, __fixtures__ and __mocks__ folders.
// .claude/rules/testing.md and the review ask for the test in src/__tests__ instead.
const testCandidates = () => null;

const PLATFORM_VALUES = new Set(['ios', 'android', 'web', 'macos', 'windows']);
const APP_STATE_VALUES = new Set(['active', 'background', 'inactive', 'unknown', 'extension']);
const SCHEME_VALUES = new Set(['light', 'dark']);
const URL_PROPERTIES = new Set(['protocol', 'hostname', 'host', 'pathname', 'origin']);
const URL_LIKE = /(^|\.)(location|url|uri|base|parsed|link|\w*(Url|URL|Uri|Location))$|^new URL\(/;
const HTTP_METHOD_VALUES = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

// Values React Native, the OS, HTTP or the URL standard define, not us.
const isPlatformValue = ({ name, receiver, value }) =>
  (name === 'OS' && /(^|\.)Platform$/.test(receiver) && PLATFORM_VALUES.has(value)) ||
  (/state$/i.test(name) && APP_STATE_VALUES.has(value)) ||
  (/scheme$/i.test(name) && SCHEME_VALUES.has(value)) ||
  (/method$/i.test(name) && HTTP_METHOD_VALUES.has(value)) ||
  (URL_PROPERTIES.has(name) && URL_LIKE.test(receiver));

export const config = {
  limits: LIMITS,
  isInScope: (path) => /^src\/.*\.[cm]?[jt]sx?$/.test(path) && !OUT_OF_SCOPE.some((pattern) => pattern.test(path)),
  // Fixtures have no line limit and no name rule. Every other rule still applies. Test fixtures belong in
  // src/__fixtures__, which is out of scope above and not published.
  isFixture: (path) => FIXTURE.some((pattern) => pattern.test(path)),
  registryFiles: new Set(),
  isModelFile: () => false,
  isParamsExemptFile: () => false,
  genericFileNames: new Set(['index', 'types', 'utils', 'helpers', 'constants', 'controller', 'model']),
  // No second system to ban by import: the one bridge to native code is the module object in src/index.tsx
  // (.claude/rules/native-bridge.md), and react-native itself must stay importable.
  extraCounters: [],
  bannedImports: [],
  // Event names and server values are compared as strings all over src/index.tsx: string-compare warns until that
  // changes. long-line warns only until the check is required; needs-test is listed like everywhere else but never
  // fires here (testCandidates). Comment stamps only warn while old comments still carry them for new ones to copy.
  warningRules: new Set(['string-compare', 'type-assertion', 'long-line', 'needs-test', 'comment-attribution', 'comment-date']),
  // Until the check is required, growth of old code warns too. A new file over newFileLines still fails.
  legacySizeGrowthWarns: true,
  stringExemptions: { isExempt: isPlatformValue },
  // `import Gleap from 'react-native-gleapsdk'` is the public API: src/index.tsx keeps its default export.
  defaultExports: { isExemptFile: (path) => path === 'src/index.tsx' },
  fixes: {
    'default-export': 'Use a named export: a default export has no canonical name, so agents cannot find or rename it reliably.',
    'string-compare':
      "Compare with a named constant: one frozen object per set of values (Object.freeze({ OPEN: 'open' })), next to the code that owns them. Search for an existing one first.",
  },
  fileNameProblem,
  folderNameProblem,
  testCandidates,
};
