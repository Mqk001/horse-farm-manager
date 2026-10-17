import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const blocked = new Set(['child_process', 'execa', 'shelljs', 'cross-spawn', 'node-pty', 'zx', 'exec-sh', 'shell-exec', 'tinyexec', 'sudo-prompt']);

// Application code has no legitimate process-launching feature. Fail closed on
// module names that cannot be reviewed statically; this is a source guard, not a sandbox.
export function executionFindings(source, filename = 'source.ts') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings = [];
  const report = (node, message) => findings.push(`${filename}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${message}`);
  const moduleName = (node, value) => {
    if (!value || !ts.isStringLiteralLike(value)) { report(node, 'Dynamic module loading requires security review.'); return; }
    const name = value.text.replace(/^node:/, '');
    if (blocked.has(name) || [...blocked].some(pkg => name.startsWith(`${pkg}/`))) report(node, `Process-execution module is prohibited: ${value.text}`);
  };
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) moduleName(node, node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      moduleName(node, node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : ts.isElementAccessExpression(expr) && expr.argumentExpression && ts.isStringLiteralLike(expr.argumentExpression) ? expr.argumentExpression.text : '';
      if (expr.kind === ts.SyntaxKind.ImportKeyword || ['require', 'getBuiltinModule'].includes(name)) moduleName(node, node.arguments[0]);
      if (['eval', 'Function', 'binding', '_linkedBinding'].includes(name)) report(node, 'Dynamic code/native binding requires security review.');
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
      report(node, 'Dynamic code requires security review.');
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return findings;
}

async function scan(directory) {
  let files = 0;
  const findings = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) { const result = await scan(target); files += result.files; findings.push(...result.findings); }
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) { files++; findings.push(...executionFindings(await readFile(target, 'utf8'), target)); }
  }
  return { files, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, findings } = await scan(fileURLToPath(new URL('../src', import.meta.url)));
  if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
  else console.log(`PASS: ${files} application files; no process-execution imports or dynamic module/code loading.`);
}
