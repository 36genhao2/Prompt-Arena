#!/usr/bin/env node
// 判词锁 · Claude Code PreToolUse 摩擦门（第一道）
// 核心判定在 arena/lib/verdict-gate.mjs，与 arena/watchdog.mjs（文件系统第二道）共用同一把钥匙。
// 摩擦门非沙箱：可被 Bash 绕过、防不住恶意；arena/ work/ .claude/ 等 meta 路径永不拦。

import { resolve } from 'node:path';
import { norm, loadConfig, projectFor, hasPassVerdict } from '../../arena/lib/verdict-gate.mjs';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let event;
try {
  event = JSON.parse(raw);
} catch {
  process.stdout.write(raw); // 解析失败 → fail-open
  process.exit(0);
}

const toolName = event?.tool_name;
const targetPath = event?.tool_input?.file_path ?? event?.tool_input?.notebook_path;
if (!WRITE_TOOLS.has(toolName) || !targetPath) {
  process.stdout.write(JSON.stringify(allow(event)));
  process.exit(0);
}

const config = loadConfig();
const realRoot = config.realWorkspaceRoot;
if (!realRoot) {
  process.stdout.write(JSON.stringify(allow(event)));
  process.exit(0);
}

const cwd = event?.cwd ?? process.cwd();
const absPath = resolve(cwd, targetPath);
const rootNorm = norm(resolve(realRoot));
const pathNorm = norm(absPath);

// 不在真工程根内（meta 路径 / 仓库外） → 放行
if (pathNorm !== rootNorm && !pathNorm.startsWith(rootNorm + (process.platform === 'win32' ? '\\' : '/'))) {
  process.stdout.write(JSON.stringify(allow(event)));
  process.exit(0);
}

// 顶层项目目录 = 真工程根后的第一段；直接落在根上 → 根即项目
const proj = projectFor(absPath, realRoot) ?? resolve(realRoot);
const unlocked = hasPassVerdict(proj, config.verdictTtlMs);

process.stdout.write(JSON.stringify(unlocked ? allow(event) : block(event)));
process.exit(0);

function allow(ev) {
  return { ...ev, hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
}
function block(ev) {
  return {
    ...ev,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'block',
      blockReason:
        '判词锁：这个路径在真工程根内，当前没有匹配且未过期的 PASS 判词。先跑 /prompt-gate，等 judge PASS 落了 arena/verdicts/<slug>.verdict.json，才许动这摊项目。',
    },
  };
}