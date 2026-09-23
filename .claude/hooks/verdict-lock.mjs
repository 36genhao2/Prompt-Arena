#!/usr/bin/env node
// 判词锁 · PreToolUse 摩擦门
// 只有 judge PASS 且 arena/verdicts/<slug>.verdict.json 里含「匹配且未过期」的解锁，
// 才许在真工程根（arena/config.json 的 realWorkspaceRoot）内 Write/Edit/NotebookEdit。
// 摩擦门非沙箱：可被 Bash 绕过、防不住恶意；arena/ work/ .claude/ 等 meta 路径永不拦。

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, resolve, parse, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const hookDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(hookDir, '..', '..');
const norm = (p) => {
  const n = normalize(p);
  return process.platform === 'win32' ? n.toLowerCase() : n;
};

const toolName = event?.tool_name;
const targetPath = event?.tool_input?.file_path ?? event?.tool_input?.notebook_path;
if (!WRITE_TOOLS.has(toolName) || !targetPath) {
  process.stdout.write(JSON.stringify(allow(event)));
  process.exit(0);
}

// ---- 读配置（缺配置 → 视为未启用锁，放行） ----
let config = { verdictTtlMs: 86400000 };
try {
  config = { ...config, ...JSON.parse(readFileSync(join(repoRoot, 'arena', 'config.json'), 'utf8')) };
} catch {}

const realRoot = config.realWorkspaceRoot;
if (!realRoot) {
  process.stdout.write(JSON.stringify(allow(event)));
  process.exit(0);
}

const cwd = event?.cwd ?? process.cwd();
const pathNorm = norm(resolve(cwd, targetPath));
const rootNorm = norm(resolve(realRoot));

// 不在真工程根内（meta 路径 / 仓库外） → 放行
if (pathNorm !== rootNorm && !pathNorm.startsWith(rootNorm + sep)) {
  process.stdout.write(JSON.stringify(allow(event)));
  process.exit(0);
}

// 顶层项目目录 = 真工程根后的第一段；直接落在根上 → 根即项目
const rel = pathNorm.slice(rootNorm.length).replace(/^[/\\]+/, '');
const firstSeg = rel.split(/[/\\]/)[0];
const projNorm = firstSeg ? norm(join(rootNorm, firstSeg)) : rootNorm;

// ---- 查 verdict：匹配 targetProject 且未过期 ----
const ttl = typeof config.verdictTtlMs === 'number' ? config.verdictTtlMs : 86400000;
const now = Date.now();
let unlocked = false;
try {
  for (const f of readdirSync(join(repoRoot, 'arena', 'verdicts'))) {
    if (!f.endsWith('.verdict.json')) continue;
    let v;
    try {
      v = JSON.parse(readFileSync(join(repoRoot, 'arena', 'verdicts', f), 'utf8'));
    } catch {
      continue;
    }
    if (v.verdict !== 'PASS' || typeof v.judgedAt !== 'number' || (v.judgedAt + ttl) < now) continue;
    if (!v.targetProject) continue;
    const tgtNorm = norm(resolve(v.targetProject));
    if (tgtNorm === projNorm || projNorm.startsWith(tgtNorm + sep)) {
      unlocked = true;
      break;
    }
  }
} catch {
  unlocked = false; // verdicts 目录未建 = 无 PASS，拦
}

// ---- 输出判定 ----
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