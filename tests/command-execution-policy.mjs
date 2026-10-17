import assert from 'node:assert/strict';
import { executionFindings } from '../scripts/check-process-execution.mjs';

for (const source of [
  `import { exec as run } from 'node:child_process'; run(input);`,
  `const cp = require('child_process'); cp.spawn(input);`,
  `await import('node:child_process');`,
  `export { exec } from 'child_process';`,
  `import cp = require('child_process');`,
  `import run from 'execa';`,
  `module.require('shelljs');`,
  `process.getBuiltinModule('child_process');`,
  `process['getBuiltinModule']('node:child_process');`,
  `await import(userInput);`,
  `require('child_' + 'process');`,
  `eval(input);`,
  `new Function(input);`,
]) assert.ok(executionFindings(source).length, `Must reject: ${source}`);
for (const source of [
  `import { readFile } from 'node:fs/promises';`,
  `import { prisma } from '@/lib/prisma'; await prisma.horse.findMany();`,
  `const match = /db/.exec(hostname);`,
  `await db.exec('CREATE ROLE anon');`,
]) assert.deepEqual(executionFindings(source), [], `Must allow: ${source}`);
console.log('PASS: process aliases/imports/re-exports, shell runners, dynamic loading/code rejected; SQL and regex exec allowed.');
