// arena/lib/verdict-gate.mjs
// 判词锁共享判定 —— 同一把钥匙。
// 「某项目在 realWorkspaceRoot 下，判断有无匹配且未过期的 PASS 判词」是唯一的门控标准，
// 供两个入口复用：.claude/hooks/verdict-lock.mjs（Claude Code 编辑时拦）与
// arena/watchdog.mjs（文件系统级兜底，agent 无关）。改判定只动这一处。

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TTL = 86400000;
const thisDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(thisDir, '..', '..'); // Prompt-Arena/

// 路径归一化（Windows 不区分大小写）
export const norm = (p) => {
  const n = normalize(p || '');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};

export function loadConfig() {
  let config = { realWorkspaceRoot: undefined, verdictTtlMs: DEFAULT_TTL };
  try {
    config = { ...config, ...JSON.parse(readFileSync(join(repoRoot, 'arena', 'config.json'), 'utf8')) };
  } catch {
    /* 缺配置 → 用默认值 */
  }
  return config;
}

// 某绝对路径归属的真项目顶层目录；不在 root 内（Equal 或 root 之上）→ null
export function projectFor(absPath, root) {
  const rootN = norm(root);
  const pathN = norm(absPath);
  if (pathN !== rootN && !pathN.startsWith(rootN + sep)) return null;
  const rel = pathN.slice(rootN.length).replace(/^[/\\]+/, '');
  const first = rel.split(/[/\\]/)[0] || '';
  if (!first) return null;
  return resolve(root, first);
}

// 该项目有没有匹配 targetProject 且未过期的 PASS 判词
export function hasPassVerdict(projectDir, ttlMs) {
  const ttl = typeof ttlMs === 'number' ? ttlMs : DEFAULT_TTL;
  const now = Date.now();
  const verDir = join(repoRoot, 'arena', 'verdicts');
  try {
    for (const f of readdirSync(verDir)) {
      if (!f.endsWith('.verdict.json')) continue;
      let v;
      try {
        v = JSON.parse(readFileSync(join(verDir, f), 'utf8'));
      } catch {
        continue;
      }
      if (v.verdict !== 'PASS' || typeof v.judgedAt !== 'number') continue;
      if (v.judgedAt + ttl < now) continue;
      if (!v.targetProject) continue;
      const tgtN = norm(resolve(v.targetProject));
      const projN = norm(resolve(projectDir));
      if (tgtN === projN || projN.startsWith(tgtN + sep)) return true;
    }
  } catch {
    /* verdicts 目录未建 = 无 PASS */
  }
  return false;
}