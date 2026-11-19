// Parses one file and collects what the rules compare. Parsing only: no Program, no type information.
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

import ts from 'typescript';

import { measureLines } from './measure.mjs';

const WRAPPER_CALL = /^(observer|memo|forwardRef|inject|useCallback|useMemo|debounce|throttle|with[A-Z]\w*)$/;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const ALLOW_COMMENT = /quality-allow[ \t]+([a-z-]+)[ \t]*:[ \t]*(\S.*?)[ \t]*(?:\*\/)?[ \t]*$/m;
// @ts-expect-error is fine with a reason on the same line.
const TS_SUPPRESSION = /@ts-(ignore|nocheck)\b|@ts-expect-error[:\s-]*(\*\/)?\s*$/m;
const BASE_COUNTERS = [
  'any',
  'ts-ignore',
  'console-log',
  'string-compare',
  'default-export',
  'comment-reference',
  'comment-attribution',
  'comment-date',
  'type-assertion',
  'non-null-assertion',
  'const-enum',
];
// `#` needs 4 digits, because #123 is a colour. A word needs the singular: "tickets 100 per page" is no reference.
const COMMENT_REFERENCE = /(?<!&)#(\d{4,})\b|\bPR\s*#?\d{3,}\b|\b[Tt]icket\s*#?\d{3,}\b/g;
// A URL and quoted text are not references: the quote shows what a user sees, like "Server #2641".
const NOT_A_REFERENCE = /https?:\/\/\S+|"[^"\n]*"|`[^`\n]*`/g;
const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'options', 'head']);
const ROUTE_RECEIVER = /(^|\.)(app|router|\w*Router|\w*App)$/;
const CONSOLE_OBJECT = /^((window|globalThis|global|self)\.)?console$/;
const CONSOLE_METHODS = new Set(['log', 'info', 'debug', 'table']);
const EQUALITY_OPERATORS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);
const SCRIPT_KINDS = new Map([
  ['tsx', ts.ScriptKind.TSX],
  ['jsx', ts.ScriptKind.JSX],
  ['js', ts.ScriptKind.JSX],
  ['mjs', ts.ScriptKind.JS],
  ['cjs', ts.ScriptKind.JS],
]);

const isStringLiteral = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/;

// The module a relative path names, from the repo root: code that moves to another folder re-paths its require, yet
// still loads the same module, so the move pool must see the same item.
const moduleTargetOf = ({ path, specifier }) =>
  specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(path), specifier)).replace(MODULE_EXTENSION, '') : specifier;

const isFunctionWithBody = (node) =>
  Boolean(node.body) &&
  (ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node));

const isJsxNode = (node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);

const isJsxResult = (expression) => {
  if (!expression) return false;
  const node = ts.skipOuterExpressions(expression);
  if (isJsxNode(node)) return true;
  if (ts.isConditionalExpression(node)) return isJsxResult(node.whenTrue) || isJsxResult(node.whenFalse);
  if (ts.isBinaryExpression(node) && !EQUALITY_OPERATORS.has(node.operatorToken.kind)) {
    return isJsxResult(node.left) || isJsxResult(node.right);
  }
  return false;
};

const calleeHead = (callee) => {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  if (ts.isCallExpression(callee)) return calleeHead(callee.expression);
  return '';
};

const isTransparent = (parent, child) =>
  ts.isParenthesizedExpression(parent) ||
  ts.isAsExpression(parent) ||
  ts.isSatisfiesExpression(parent) ||
  ts.isNonNullExpression(parent) ||
  ts.isTypeAssertionExpression(parent) ||
  (ts.isCallExpression(parent) && parent.arguments.includes(child) && WRAPPER_CALL.test(calleeHead(parent.expression)));

const outermost = (node) => {
  let current = node;
  while (current.parent && isTransparent(current.parent, current)) current = current.parent;
  return current;
};

const isCallArgumentOrJsx = (node) => {
  let current = node;
  while (
    current.parent &&
    (ts.isObjectLiteralExpression(current.parent) ||
      ts.isArrayLiteralExpression(current.parent) ||
      ts.isPropertyAssignment(current.parent) ||
      isTransparent(current.parent, current))
  ) {
    current = current.parent;
  }
  const parent = current.parent;
  return Boolean(parent) && (ts.isCallExpression(parent) || ts.isNewExpression(parent) || ts.isJsxExpression(parent));
};

const propertyNameText = (name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText());

const describeExpressionFunction = (node) => {
  const outer = outermost(node);
  const parent = outer.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return { name: parent.name.text, isTyped: Boolean(parent.type) };
  }
  if (ts.isPropertyAssignment(parent)) {
    return { name: propertyNameText(parent.name), isCallback: isCallArgumentOrJsx(parent.parent) };
  }
  if (ts.isPropertyDeclaration(parent)) return { name: propertyNameText(parent.name), isTyped: Boolean(parent.type) };
  if (ts.isBinaryExpression(parent) && parent.right === outer) return { name: parent.left.getText() };
  if (ts.isExportAssignment(parent)) return { name: 'default' };
  return { isCallback: ts.isCallExpression(parent) || ts.isNewExpression(parent) || ts.isJsxExpression(parent), outer };
};

const describeFunction = (node) => {
  if (ts.isFunctionDeclaration(node)) return { name: node.name?.text ?? 'default' };
  if (ts.isConstructorDeclaration(node)) return { name: 'constructor' };
  if (ts.isGetAccessorDeclaration(node)) return { name: `get ${propertyNameText(node.name)}` };
  if (ts.isSetAccessorDeclaration(node)) return { name: `set ${propertyNameText(node.name)}` };
  if (ts.isMethodDeclaration(node)) {
    const isCallback = ts.isObjectLiteralExpression(node.parent) && isCallArgumentOrJsx(node.parent);
    return { name: propertyNameText(node.name), isCallback };
  }
  return describeExpressionFunction(node);
};

const moduleLevelCallbackName = (outer) => {
  let current = outer.parent;
  while (current && (ts.isCallExpression(current) || isTransparent(current.parent ?? current, current))) {
    if (ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) return current.parent.name.text;
    current = current.parent;
  }
  if (!outer.parent || !ts.isCallExpression(outer.parent)) return 'anonymous';
  const firstArgument = outer.parent.arguments[0];
  const callee = outer.parent.expression.getText().replace(/\s+/g, '').slice(0, 60);
  return firstArgument && isStringLiteral(firstArgument) ? `${callee}('${firstArgument.text}')` : callee;
};

const bodyHashOf = (node) => {
  const text = `${node.parameters.map((parameter) => parameter.getText()).join(',')}=>${node.body.getText()}`;
  return createHash('sha1').update(text.replace(/\s+/g, '')).digest('hex');
};

// `@Request() request: any` is the one exemption from counting `any`: there are 1372 of these and no usable type yet.
// A typed request belongs to the strict-types step.
const isDecoratedRequestAny = (node) => {
  const parameter = node.parent;
  if (!ts.isParameter(parameter) || parameter.type !== node) return false;
  return (ts.getDecorators(parameter) ?? []).some((decorator) => calleeHead(decorator.expression) === 'Request');
};

const isConsoleNoise = (node) => {
  if (ts.isPropertyAccessExpression(node)) {
    return CONSOLE_METHODS.has(node.name.text) && CONSOLE_OBJECT.test(node.expression.getText());
  }
  if (ts.isElementAccessExpression(node) && isStringLiteral(node.argumentExpression)) {
    return CONSOLE_METHODS.has(node.argumentExpression.text) && CONSOLE_OBJECT.test(node.expression.getText());
  }
  if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
    if (!CONSOLE_OBJECT.test(node.initializer.getText())) return false;
    return node.name.elements.some((element) => CONSOLE_METHODS.has((element.propertyName ?? element.name).getText()));
  }
  return false;
};

// `x as unknown as T` is `any` in disguise, and agents would move there if it counted as less.
const isDoubleAssertion = (node) => {
  if (!ts.isAsExpression(node) || node.type.kind === ts.SyntaxKind.UnknownKeyword) return false;
  const inner = ts.skipOuterExpressions(node.expression, ts.OuterExpressionKinds.Parentheses);
  return ts.isAsExpression(inner) && inner.type.kind === ts.SyntaxKind.UnknownKeyword;
};

const isPartOfDoubleAssertion = (node) => {
  const outer = ts.isParenthesizedExpression(node.parent) ? node.parent.parent : node.parent;
  return node.type.kind === ts.SyntaxKind.UnknownKeyword && ts.isAsExpression(outer);
};

const isCountedAssertion = (node) => {
  if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return false;
  if (ts.isConstTypeReference(node.type) || node.type.kind === ts.SyntaxKind.AnyKeyword) return false;
  if (isDoubleAssertion(node) || isPartOfDoubleAssertion(node)) return false;
  return !ts.isAsExpression(node.parent);
};

const isConstEnum = (node) => ts.isEnumDeclaration(node) && (node.modifiers ?? []).some(({ kind }) => kind === ts.SyntaxKind.ConstKeyword);

const isRouteRegistration = (node) => {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const { name, expression: receiver } = node.expression;
  if (!HTTP_VERBS.has(name.text) || node.arguments.length < 2 || !ROUTE_RECEIVER.test(receiver.getText())) return false;
  const [path] = node.arguments;
  return isStringLiteral(path) || ts.isTemplateExpression(path) || ts.isRegularExpressionLiteral(path) || ts.isArrayLiteralExpression(path);
};

const isEmptyConflictError = (node) => {
  if (!ts.isNewExpression(node) || node.expression.getText() !== 'ConflictError') return false;
  const [first] = node.arguments ?? [];
  return !first || (ts.isObjectLiteralExpression(first) && first.properties.length === 0);
};

const isLoadCall = (node) =>
  ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'));

const requireTargetOf = (node) => (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) ? node.moduleReference.expression : null);

// A require or import() inside a function hides an import cycle. Only heavy packages may load late.
const isLocalRequire = ({ node, owner, config }) => {
  const importEqualsTarget = requireTargetOf(node);
  if (importEqualsTarget) return isStringLiteral(importEqualsTarget) && importEqualsTarget.text.startsWith('.');
  if (!isLoadCall(node)) return false;
  const [target] = node.arguments;
  if (!target) return false;
  if (!isStringLiteral(target)) return Boolean(owner);
  if (target.text.startsWith('.')) return true;
  return Boolean(owner) && !config.lazyRequireAllowed.test(target.text);
};

const isDefaultExport = (node) => {
  if (ts.isExportAssignment(node)) return !node.isExportEquals;
  if (ts.isExportSpecifier(node)) return node.name.text === 'default';
  if (!ts.isFunctionDeclaration(node) && !ts.isClassDeclaration(node)) return false;
  return (node.modifiers ?? []).some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword);
};

// In a comment, #808080 and #00000080 are colours: a grey repeats one pair, and ticket numbers have 6 digits at most.
const looksLikeHexColor = (digits) => digits.length === 8 || /^(\d\d)\1\1$/.test(digits);

const namesReference = (comment) =>
  [...comment.replace(NOT_A_REFERENCE, '').matchAll(COMMENT_REFERENCE)].some(([, hashDigits]) => !hashDigits || !looksLikeHexColor(hashDigits));

// First names of the git authors of both repos. Kai and Claude are products, not people.
const TEAM_NAME = /\b(?:Lukas|Tobias|Luca|Florian|Manuel|Hagop|Eleni|Simon|Niklas|Andrei|Ali)\b/g;
// A year before 2025 is an API version such as Twilio's 2010-04-01, never a stamp. A date after a quote is data.
const MONTH_DAY = /(?<![\w.:/#'=-])(?:20(?:2[5-9]|[3-9]\d)-)?(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\w-])/g;
// "10-15 s" is a timeout, "06-03 → 10-10" a span and "e.g. 10-27" an example: none of them stamps a day.
const UNIT =
  /(?:s|secs?|seconds?|ms|mins?|minutes?|h|hrs?|hours?|days?|weeks?|months?|percent|px|pt|r?em|words?|tokens?|chars?|characters?|lines?|items?|rows?|requests?|calls?|retries|retry|attempts?|times|[kmg]b)\b|%|×|x\b/;
const RANGE_OR_UNIT_AFTER = new RegExp(`^\\s*(?:(?:–|—|-|→|\\+|\\.\\.|…|to\\b|until\\b|till\\b)\\s*\\d|${UNIT.source})`, 'i');
const RANGE_OR_EXAMPLE_BEFORE = /(?:→|–|—|…|\.\.|\d\s+-|\b(?:to|between|e\.g\.|i\.e\.|for example|such as|like))\s*$/i;
// A comment line that is only an allow; inside a block it is skipped, not the whole block.
const ALLOW_LINE = new RegExp(ALLOW_COMMENT.source);
// "created before 10-21" can be the cutoff the code depends on, so it counts as a plain date, in parentheses too.
const CUTOFF_BEFORE = /\b(?:since|before|until|till|after|from|by|through|than)\s+(?:the\s+)?$/i;
const QUOTED_OR_LINK = /https?:\/\/\S+|"[^"]*"|`[^`]*`|“[^”]*”/g;
const LOOK_AROUND = 40;
const RULE_WEIGHT = { 'comment-attribution': 2, 'comment-date': 1 };

// Line comments on consecutive lines, or the lines of one block, are read together so a stamp that wraps is still
// found. Each line is its own item: editing the lines around an old stamp leaves it old. A line comment reports
// itself; a block reports where it starts, so an allow above the block covers it. An allow right above a run of line
// comments covers the whole run for its rule. Allow lines are never read.
const commentGroupsOf = (comments) => {
  const groups = [];
  let previous = null;
  let allow = null;
  for (const comment of comments) {
    const isLineComment = comment.text.startsWith('//');
    if (isLineComment && ALLOW_COMMENT.test(comment.text)) {
      previous = null;
      allow = { rule: comment.text.match(ALLOW_COMMENT)[1], line: comment.line };
      continue;
    }
    const lines = comment.text
      .split('\n')
      .map((text, offset) => ({ text: ALLOW_LINE.test(text) ? '' : text, line: isLineComment ? comment.startLine + offset : comment.startLine }));
    const continues = previous?.isLineComment && isLineComment && comment.startLine === previous.line + 1;
    if (continues) groups.at(-1).lines.push(...lines);
    else groups.push({ lines, allowedRule: allow?.line === comment.startLine - 1 ? allow.rule : null });
    previous = { isLineComment, line: comment.line };
    allow = null;
  }
  return groups;
};

const blank = (text) => text.replace(/[^\n]/g, ' ');

// The group as one text with the comment markers and quotes blanked out, so every offset still points into its line.
const proseOf = (lines) =>
  lines
    .map(({ text }) => text.replace(/^[ \t]*(?:\/\/+|\/\*+|\*+)/, blank).replace(/\*\/\s*$/, blank))
    .join('\n')
    .replace(QUOTED_OR_LINK, blank);

// A date in parentheses stamps when something happened nearly every time; elsewhere it is sometimes a reason.
const markDates = ({ prose, mark }) => {
  let depth = 0;
  let scanned = 0;
  for (const match of prose.matchAll(MONTH_DAY)) {
    for (; scanned < match.index; scanned += 1) {
      if (prose[scanned] === '(') depth += 1;
      if (prose[scanned] === ')') depth = Math.max(0, depth - 1);
    }
    const before = prose.slice(Math.max(0, match.index - LOOK_AROUND), match.index);
    const end = match.index + match[0].length;
    if (RANGE_OR_EXAMPLE_BEFORE.test(before) || RANGE_OR_UNIT_AFTER.test(prose.slice(end, end + LOOK_AROUND))) continue;
    mark(match.index, depth > 0 && !CUTOFF_BEFORE.test(before) ? 'comment-attribution' : 'comment-date');
  }
};

const firstAbove = ({ sorted, value }) => {
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (value < sorted[middle]) high = middle;
    else low = middle + 1;
  }
  return low;
};

const readAttributions = ({ comments, counters }) => {
  for (const { lines, allowedRule } of commentGroupsOf(comments)) {
    const prose = proseOf(lines);
    const lineEnds = [];
    for (const { text } of lines) lineEnds.push((lineEnds.at(-1) ?? -1) + text.length + 1);
    const rules = new Map();
    const mark = (offset, rule) => {
      const index = firstAbove({ sorted: lineEnds, value: offset });
      if ((RULE_WEIGHT[rules.get(index)] ?? 0) < RULE_WEIGHT[rule]) rules.set(index, rule);
    };
    for (const match of prose.matchAll(TEAM_NAME)) mark(match.index, 'comment-attribution');
    markDates({ prose, mark });
    for (const [index, rule] of rules) counters[rule].push({ line: rule === allowedRule ? lines[0].line : lines[index].line, text: lines[index].text.trim() });
  }
};

const hasOnlyTypes = (elements) => elements.length > 0 && elements.every((element) => element.isTypeOnly);

const isTypeOnlyImport = ({ importClause }) => {
  if (!importClause) return false;
  if (importClause.isTypeOnly) return true;
  const { name, namedBindings } = importClause;
  return !name && Boolean(namedBindings) && ts.isNamedImports(namedBindings) && hasOnlyTypes(namedBindings.elements);
};

const isTypeOnlyReExport = ({ isTypeOnly, exportClause }) => isTypeOnly || (Boolean(exportClause) && ts.isNamedExports(exportClause) && hasOnlyTypes(exportClause.elements));

// The string that names the module an import, export, require or import() loads.
const moduleSpecifierNodeOf = (node) => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier ?? null;
  const target = requireTargetOf(node) ?? (isLoadCall(node) ? node.arguments[0] : null);
  return target && isStringLiteral(target) ? target : null;
};

// Every way this file reaches another module, static or late.
const moduleUseOf = (node) => {
  if (ts.isImportDeclaration(node)) return { specifier: node.moduleSpecifier.text, isTypeOnly: isTypeOnlyImport(node) };
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) return { specifier: node.moduleSpecifier.text, isTypeOnly: isTypeOnlyReExport(node) };
  const target = moduleSpecifierNodeOf(node);
  return target ? { specifier: target.text, isTypeOnly: false } : null;
};

const isStringComparisonToCount = ({ compared, literal, strings }) => {
  const other = ts.skipOuterExpressions(compared);
  if (literal.text === '' || ts.isTypeOfExpression(other)) return false;
  const isProperty = ts.isPropertyAccessExpression(other);
  const name = isProperty ? other.name.text : ts.isIdentifier(other) ? other.text : '';
  return !strings.isExempt({ name, receiver: isProperty ? other.expression.getText() : '', value: literal.text });
};

const collectFacts = ({ path, sourceFile, measure, config }) => {
  const { lineOf, codeLinesOf } = measure;
  const lineTexts = sourceFile.text.split('\n');
  const functions = new Map();
  const regions = new Map();
  const counters = Object.fromEntries([...BASE_COUNTERS, ...config.extraCounters].map((rule) => [rule, []]));
  const usedKeys = new Map();
  const imports = [];

  const lineNumberOf = (node) => lineOf(node.getStart(sourceFile)) + 1;
  // An item is its line; a relative module path in it counts as the module it names (moduleTargetOf).
  const count = (rule, line, specifierNode = null) => {
    const text = lineTexts[line - 1].trim();
    const raw = specifierNode && isStringLiteral(specifierNode) && specifierNode.text.startsWith('.') ? specifierNode.getText(sourceFile) : null;
    const item = raw && text.includes(raw) ? text.replace(raw, `<${moduleTargetOf({ path, specifier: specifierNode.text })}>`) : text;
    counters[rule].push({ line, text: item });
  };
  const uniqueKey = (key) => {
    const seen = (usedKeys.get(key) ?? 0) + 1;
    usedKeys.set(key, seen);
    return seen === 1 ? key : `${key}#${seen}`;
  };
  const qualify = (scope, name) => (scope ? `${scope}.${name}` : name);

  const recordJsx = (owner, node) => {
    if (!owner) return;
    const lines = codeLinesOf(node);
    if (lines > owner.jsxReturnLines) {
      owner.jsxReturnLines = lines;
      owner.jsxReturnLine = lineNumberOf(node);
    }
  };

  const trackFunction = (node, { naming, context }) => {
    const name = naming.name ?? moduleLevelCallbackName(naming.outer);
    const params = node.parameters.filter((parameter) => parameter.name.getText() !== 'this');
    const fact = {
      key: uniqueKey(qualify(context.scope, name)),
      name,
      bodyHash: bodyHashOf(node),
      line: lineNumberOf(node),
      lines: codeLinesOf(node),
      params: params.length,
      isParamsExempt:
        Boolean(naming.isCallback || naming.isTyped) || params.some((parameter) => parameter.type?.getText() === 'NextFunction'),
      isNested: Boolean(context.owner),
      hasOwnJsx: false,
      returnsJsx: false,
      jsxReturnLines: 0,
      jsxReturnLine: lineNumberOf(node),
    };
    functions.set(fact.key, fact);
    return fact;
  };

  const countComparison = (node) => {
    const { stringExemptions: strings } = config;
    if (ts.isBinaryExpression(node) && EQUALITY_OPERATORS.has(node.operatorToken.kind)) {
      const right = ts.skipOuterExpressions(node.right);
      const left = ts.skipOuterExpressions(node.left);
      const [literal, compared] = isStringLiteral(right) ? [right, node.left] : [left, node.right];
      if (isStringLiteral(literal) && isStringComparisonToCount({ compared, literal, strings })) count('string-compare', lineNumberOf(node));
    }
    if (ts.isCaseClause(node)) {
      const literal = ts.skipOuterExpressions(node.expression);
      const compared = node.parent.parent.expression;
      if (isStringLiteral(literal) && isStringComparisonToCount({ compared, literal, strings })) count('string-compare', lineNumberOf(node));
    }
  };

  const countBannedImport = (node) => {
    const moduleUse = moduleUseOf(node);
    if (!moduleUse || moduleUse.isTypeOnly) return;
    for (const { rule, module, isExemptFile } of config.bannedImports) {
      if (module.test(moduleUse.specifier) && !isExemptFile?.(path)) count(rule, lineNumberOf(node), moduleSpecifierNodeOf(node));
    }
  };

  const countOptionalRules = (node, owner) => {
    if (counters['local-require'] && isLocalRequire({ node, owner, config })) count('local-require', lineNumberOf(node), moduleSpecifierNodeOf(node));
    if (counters['server-logs'] && ts.isCallExpression(node) && node.expression.getText() === 'ServerLogs.send') count('server-logs', lineNumberOf(node));
    if (counters['empty-conflict-error'] && isEmptyConflictError(node)) count('empty-conflict-error', lineNumberOf(node));
    if (counters['route-outside-tsoa'] && isRouteRegistration(node)) count('route-outside-tsoa', lineNumberOf(node));
  };

  const recordRegion = (node) => {
    if (ts.isEnumDeclaration(node)) regions.set(`enum:${node.name.text}`, codeLinesOf(node));
    if (ts.isInterfaceDeclaration(node)) regions.set(`type:${node.name.text}`, codeLinesOf(node));
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) regions.set(`type:${node.name.text}`, codeLinesOf(node));
    if (ts.isNewExpression(node) && calleeHead(node.expression) === 'Schema') {
      const holder = ts.isVariableDeclaration(node.parent) ? node.parent.name.getText() : lineNumberOf(node);
      regions.set(`schema:${holder}`, codeLinesOf(node));
    }
  };

  const isObjectValue = (value) => Boolean(value) && ts.isObjectLiteralExpression(ts.skipOuterExpressions(value));

  const scopeFor = (node, scope) => {
    if (ts.isClassLike(node)) return qualify(scope, node.name?.text ?? 'default');
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isObjectValue(node.initializer)) {
      return qualify(scope, node.name.text);
    }
    if (ts.isPropertyAssignment(node) && isObjectValue(node.initializer)) return qualify(scope, propertyNameText(node.name));
    return scope;
  };

  const walk = (node, context) => {
    if (isDefaultExport(node) && !config.defaultExports.isExemptFile(path)) count('default-export', lineNumberOf(node));
    const moduleUse = moduleUseOf(node);
    if (moduleUse) imports.push({ ...moduleUse, line: lineNumberOf(node) });
    if (isFunctionWithBody(node)) return walkFunction(node, context);
    if (node.kind === ts.SyntaxKind.AnyKeyword && !isDecoratedRequestAny(node)) count('any', lineNumberOf(node));
    if (isConsoleNoise(node)) count('console-log', lineNumberOf(node));
    if (isDoubleAssertion(node)) count('any', lineNumberOf(node));
    if (isCountedAssertion(node)) count('type-assertion', lineNumberOf(node));
    if (ts.isNonNullExpression(node)) count('non-null-assertion', lineNumberOf(node));
    if (isConstEnum(node)) count('const-enum', lineNumberOf(node));
    countComparison(node);
    countBannedImport(node);
    countOptionalRules(node, context.owner);
    recordRegion(node);
    let { isInsideJsx } = context;
    if (isJsxNode(node)) {
      if (context.owner) context.owner.hasOwnJsx = true;
      if (!isInsideJsx) recordJsx(context.owner, node);
      isInsideJsx = true;
    }
    if (ts.isReturnStatement(node) && isJsxResult(node.expression) && context.owner) {
      recordJsx(context.owner, node);
      if (context.isDirect) context.owner.returnsJsx = true;
    }
    const next = { ...context, isInsideJsx, scope: scopeFor(node, context.scope) };
    ts.forEachChild(node, (child) => walk(child, next));
  };

  const walkFunction = (node, context) => {
    const naming = describeFunction(node);
    // An unnamed callback inside a named function belongs to that function.
    const fact = naming.name || !context.owner ? trackFunction(node, { naming, context }) : null;
    const inner = fact ? { scope: fact.key, owner: fact, isDirect: true, isInsideJsx: false } : { ...context, isDirect: false };
    if (ts.isArrowFunction(node) && isJsxResult(node.body) && inner.owner) {
      if (!inner.isInsideJsx) recordJsx(inner.owner, node.body);
      if (inner.isDirect) inner.owner.returnsJsx = true;
    }
    ts.forEachChild(node, (child) => walk(child, inner));
  };

  ts.forEachChild(sourceFile, (child) => walk(child, { scope: '', owner: null, isDirect: false, isInsideJsx: false }));

  for (const fact of functions.values()) {
    const baseName = fact.name.split('.').pop();
    const looksLikeComponent = PASCAL_CASE.test(baseName) || fact.name === 'default' || fact.name === 'render';
    fact.isComponent = fact.hasOwnJsx && looksLikeComponent;
    fact.isPascalCase = PASCAL_CASE.test(baseName);
    fact.baseName = baseName;
  }
  return { functions, regions, counters, imports };
};

const readComments = ({ comments, counters }) => {
  const allows = [];
  for (const comment of comments) {
    if (TS_SUPPRESSION.test(comment.text)) {
      counters['ts-ignore'].push({ line: comment.line, text: comment.text.trim() });
    }
    if (namesReference(comment.text)) counters['comment-reference'].push({ line: comment.startLine, text: comment.text.trim() });
    const match = comment.text.match(ALLOW_COMMENT);
    if (match) allows.push({ rule: match[1], reason: match[2], line: comment.line });
  }
  readAttributions({ comments, counters });
  return allows;
};

const isLiteralValue = (value) => {
  if (!value) return false;
  const node = ts.skipOuterExpressions(value);
  return (
    ts.isObjectLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  );
};


// A table has no logic to split, whatever its file is called: translations, templates, time zones.
const isDataFile = ({ sourceFile, measure, functions, limits }) => {
  if (measure.codeLines < limits.dataMinLines) return false;
  let dataLines = 0;
  for (const statement of sourceFile.statements) {
    const isLiteral = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.every((declaration) => isLiteralValue(declaration.initializer))
      : ts.isExportAssignment(statement) && isLiteralValue(statement.expression);
    if (isLiteral) dataLines += measure.codeLinesOf(statement);
  }
  for (const fact of functions.values()) if (!fact.isNested) dataLines -= fact.lines;
  return dataLines / measure.codeLines >= limits.dataShare;
};

export const analyzeSource = ({ path, source, config }) => {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
    true,
    SCRIPT_KINDS.get(path.split('.').pop()) ?? ts.ScriptKind.TS
  );
  const measure = measureLines({ sourceFile, lineChars: config.limits.lineChars });
  const { functions, regions, counters, imports } = collectFacts({ path, sourceFile, measure, config });
  const allows = readComments({ comments: measure.comments, counters });
  const [parseError] = sourceFile.parseDiagnostics;
  const importLines = new Set();
  let importCodeLines = 0;
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !(ts.isExportDeclaration(statement) && statement.moduleSpecifier)) continue;
    importCodeLines += measure.codeLinesOf(statement);
    const lastLine = measure.lineOf(statement.end);
    for (let line = measure.lineOf(statement.getStart(sourceFile)); line <= lastLine; line += 1) importLines.add(line + 1);
  }
  return {
    imports,
    codeLines: measure.codeLines,
    codeLineTexts: measure.codeLineTexts,
    importCodeLines,
    firstCodeLine: measure.firstCodeLine,
    // A list of names is no squeezed code, and an import cannot be broken up by responsibility.
    longLines: measure.longLines.filter(({ line }) => !importLines.has(line)),
    functions,
    regions,
    counters,
    allows,
    isDataFile: isDataFile({ sourceFile, measure, functions, limits: config.limits }),
    parseError: parseError
      ? { line: measure.lineOf(parseError.start) + 1, message: ts.flattenDiagnosticMessageText(parseError.messageText, ' ') }
      : null,
    definesComponent: [...functions.values()].some((fact) => fact.isComponent && !fact.isNested),
  };
};
