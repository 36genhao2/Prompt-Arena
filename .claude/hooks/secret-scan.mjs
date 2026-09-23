#!/usr/bin/env node
// 提交前扫密钥 —— 两种模式共用一份逻辑:
//  git pre-commit   : 无 stdin JSON → 命中打印并 exit 1(拦 commit)
//  Claude PreToolUse: stdin 为 hook JSON → 命中输出 block JSON,否则回吐放行

import { execFileSync } from 'node:child_process';

const PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/i,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/i,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/i,
  /\bgh[ousr]_[A-Za-z0-9]{20,}/,
  /glpat-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /xox[baprs]-[0-9A-Za-z-]{10,}/,
  /\bsk_live_[0-9a-zA-Z]{16,}/,
  /-----BEGIN [A-Za-z ]*PRIVATE KEY-----/,
  /(?:client[_-]?secret|api[_-]?key|access[_-]?token|secret[_-]?key)['"]?\s*[:=]\s*['"][A-Za-z0-9+/_=-]{16,}/i,
];
const ENV_FILE = /(^|\/)\.env([^/]*)?$/;

function run(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function scan() {
  const diff = run(['diff', '--cached', '--no-color']);
  if (!diff) return { hits: [], envFiles: [] };
  const lines = diff.split('\n');
  const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const hits = [];
  for (const line of added) {
    if (PATTERNS.some((re) => re.test(line))) {
      hits.push('+ ' + line.slice(0, 220));
    }
  }
  const envFiles = lines.filter((l) => /^\+\+\+/.test(l)).map((l) => l.slice(6)).filter((p) => ENV_FILE.test(p));
  return { hits, envFiles };
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  const { hits, envFiles } = scan();
  const problem = hits.length > 0 || envFiles.length > 0;

  if (!raw.trim().startsWith('{')) {
    if (problem) {
      const msg = ['提交拦截: 暂存区疑似含密钥。'];
      hits.forEach((h) => msg.push('  ' + h));
      envFiles.forEach((f) => msg.push('  检出 .env 类文件: ' + f));
      msg.push('若非敏感,用 git commit --no-verify 显式绕过。');
      process.stderr.write(msg.join('\n') + '\n');
    }
    process.exit(problem ? 1 : 0);
  }

  if (problem) {
    const tail = hits.length ? hits.join('\n') + '\n' : '';
    const envTail = envFiles.length ? '检出 .env 类文件:\n' + envFiles.map((f) => '  ' + f).join('\n') + '\n' : '';
    const reason =
      '提交拦截: 暂存区疑似含密钥。\n' + tail + envTail + '若非敏感,用 git commit --no-verify 显式绕过。';
    const out = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'block',
        blockReason: reason,
      },
    };
    process.stdout.write(JSON.stringify(out));
  } else {
    process.stdout.write(raw);
  }
});