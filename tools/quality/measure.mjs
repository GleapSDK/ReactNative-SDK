// Counts what is on each line of a parsed file: code lines, comments and how wide the code really is.
import ts from 'typescript';

const COMMENT = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;
// Text an author cannot break up without changing it: it does not count towards a line's width.
const TEXT_TOKENS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
  ts.SyntaxKind.RegularExpressionLiteral,
]);

export const measureLines = ({ sourceFile, lineChars }) => {
  const { text } = sourceFile;
  const lineOf = (position) => sourceFile.getLineAndCharacterOfPosition(position).line;
  const lineStarts = sourceFile.getLineStarts();
  const marked = new Uint8Array(lineStarts.length);
  const spans = new Map();
  const comments = [];
  let previousEnd = 0;

  const recordSpan = ({ token, start, line }) => {
    const span = spans.get(line) ?? { first: start, last: token.end, textChars: 0 };
    span.first = Math.min(span.first, start);
    span.last = Math.max(span.last, token.end);
    if (TEXT_TOKENS.has(token.kind)) span.textChars += token.end - start;
    spans.set(line, span);
  };

  const visitToken = (token, shouldMark) => {
    const start = token.getStart(sourceFile);
    const gap = text.slice(previousEnd, start);
    // Between two tokens there is only whitespace and comments, so a regex is safe here and only here.
    for (const match of gap.matchAll(COMMENT)) {
      const commentStart = previousEnd + match.index;
      comments.push({ text: match[0], startLine: lineOf(commentStart) + 1, line: lineOf(commentStart + match[0].length) + 1 });
    }
    previousEnd = Math.max(previousEnd, token.end);
    const isBlankJsxText = token.kind === ts.SyntaxKind.JsxText && token.containsOnlyTriviaWhiteSpaces;
    if (!shouldMark || isBlankJsxText || token.end <= start) return;
    const firstLine = lineOf(start);
    const lastLine = lineOf(token.end - 1);
    for (let line = firstLine; line <= lastLine; line += 1) marked[line] = 1;
    if (firstLine === lastLine) recordSpan({ token, start, line: firstLine });
  };
  const visit = (node, shouldMark) => {
    const children = node.getChildren(sourceFile);
    if (!children.length) {
      if (node.kind !== ts.SyntaxKind.SyntaxList) visitToken(node, shouldMark);
      return;
    }
    const childMark = shouldMark && !(ts.isJsxExpression(node) && !node.expression);
    for (const child of children) visit(child, childMark);
  };
  visit(sourceFile, true);

  const lineTextOf = (line) => text.slice(lineStarts[line], line + 1 < lineStarts.length ? lineStarts[line + 1] : text.length).trim();
  const codeUpTo = new Uint32Array(lineStarts.length + 1);
  const codeLineTexts = [];
  let firstCodeLine = lineStarts.length + 1;
  for (let line = 0; line < lineStarts.length; line += 1) {
    const lineText = marked[line] === 1 ? lineTextOf(line) : '';
    codeUpTo[line + 1] = codeUpTo[line] + (lineText ? 1 : 0);
    if (!lineText) continue;
    codeLineTexts.push(lineText);
    if (line + 1 < firstCodeLine) firstCodeLine = line + 1;
  }
  const longLines = [];
  for (const [line, span] of spans) {
    const width = span.last - span.first - span.textChars;
    if (width > lineChars) longLines.push({ line: line + 1, text: lineTextOf(line), width });
  }
  const codeLinesOf = (node) => codeUpTo[lineOf(node.end) + 1] - codeUpTo[lineOf(node.getStart(sourceFile))];
  return { comments, codeLines: codeUpTo[lineStarts.length], codeLineTexts, firstCodeLine, longLines, lineOf, codeLinesOf };
};
