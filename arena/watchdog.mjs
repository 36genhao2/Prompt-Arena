#!/usr/bin/env node
// arena/watchdog.mjs · 判词锁守护进程（第二道 · agent 无关）
// 盯住 realWorkspaceRoot：任何工具（Codex / Cursor / Copilot / 原生编辑器……）往没有
// PASS verdict 的项目里写文件 → 隔离到 .quarantine/（不销毁），verdict 落地后自动还原。
// 判定与 Claude hook 共用 arena/lib/verdict-gate.mjs —— 同一把钥匙，两个插锁点。
//
// 用法：
//   node arena/watchdog.mjs               # 常驻（fs.watch + 轮询，推荐）
//   node arena/watchdog.mjs --once        # 跑一轮即退（配系统任务计划兜底保活）
//   node arena/watchdog.mjs --root <dir>  # 覆盖 realWorkspaceRoot（测试 / 沙箱）
//   node arena/watchdog.mjs --restore all # 手动还原隔离的违规文件（或 --restore <项目名>）
//   node arena/watchdog.mjs --list        # 列出隔离区
//   node arena/watchdog.mjs --status      # 报告每个真项目的门控状态
// 常驻与定时 --once 二选一，别同时跑。

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, basename, resolve } from 'node:path';
import { loadConfig, projectFor, hasPassVerdict } from './lib/verdict-gate.mjs';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
};
const args = {
  once: flag('--once'),
  list: flag('--list'),
  status: flag('--status'),
  help: flag('--help'),
  restore: value('--restore'),
  root: value('--root'),
};

// ---------- 配置 ----------
const config = loadConfig();
const ROOT = args.root ? resolve(args.root) : config.realWorkspaceRoot ? resolve(config.realWorkspaceRoot) : null;
const SEC = config.watchdog || {};
const POLL_MS = SEC.pollIntervalMs ?? 2500;
const QUAR_NAME = SEC.quarantineDir ?? '.quarantine';
const IGNORE = new Set(SEC.ignore ?? ['.git', '.quarantine', 'node_modules', '.venv', 'venv', '__pycache__', '.DS_Store']);
const TTL_MS = config.verdictTtlMs;

const STATIC_QUAR = () => join(ROOT, QUAR_NAME);
const AUDIT = () => join(ROOT, QUAR_NAME, 'audit.jsonl');
const SNAP = () => join(ROOT, QUAR_NAME, 'snapshot.json');

// ---------- 基础 ----------
function log(rec) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...rec }) + '\n';
  try {
    mkdirSync(dirname(AUDIT()), { recursive: true });
    appendFileSync(AUDIT(), line, 'utf8');
  } catch (err) {
    console.error('[watchdog] audit 写入失败:', err.message);
  }
  console.log(`[watchdog] ${rec.event}${rec.project ? ' · ' + rec.project : ''}${rec.src ? ' · ' + rec.src : ''}`);
}

// 遍历快照（跳过 ignore；.quarantine 自身永不被盯）
function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const abs = join(dir, e.name);
    const relp = relative(ROOT, abs).replaceAll('\\', '/');
    if (e.isDirectory()) walk(abs, out);
    else if (e.isFile()) {
      try {
        const s = statSync(abs);
        out.set(relp, { m: s.mtimeMs, z: s.size });
      } catch {
        /* 读不到的偶发文件跳过 */
      }
    }
  }
  return out;
}

function loadBaseline() {
  try {
    return new Map(JSON.parse(readFileSync(SNAP(), 'utf8')));
  } catch {
    return null;
  }
}
function saveBaseline(map) {
  try {
    mkdirSync(dirname(SNAP()), { recursive: true });
    writeFileSync(SNAP(), JSON.stringify([...map]), 'utf8');
  } catch {
    /* 快照写失败不致命 */
  }
}

// 对比两份快照 → 事件列表
function diff(oldSnap, newSnap) {
  const ev = [];
  for (const [relp, meta] of newSnap) {
    const prev = oldSnap.get(relp);
    if (!prev) ev.push({ kind: 'create', relp, meta });
    else if (prev.m !== meta.m || prev.z !== meta.z) ev.push({ kind: 'modify', relp, meta });
  }
  for (const relp of oldSnap.keys()) {
    if (!newSnap.has(relp)) ev.push({ kind: 'delete', relp });
  }
  return ev;
}

const pendingRetry = new Set();

function quarantine(srcAbs, relp) {
  const proj = projectFor(srcAbs, ROOT);
  const stamp = Date.now();
  const safe = relp.replace(/[\\/]+/g, '__').replace(/[^A-Za-z0-9_.\-一-龥]+/g, '_');
  const dst = join(ROOT, QUAR_NAME, `${stamp}__${proj ? basename(proj) : 'root'}__${safe}`);
  try {
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(srcAbs, dst); // 同卷移动 ≈ 截断式隔离
  } catch (err) {
    // 文件被写进程占着（EBUSY）→ 记 pending，等下一轮再试
    pendingRetry.add(relp);
    log({ event: 'quarantine-failed', project: proj && basename(proj), src: relp, detail: `${err.code}: ${err.message}` });
    return;
  }
  pendingRetry.delete(relp);
  log({ event: 'quarantine', project: proj && basename(proj), src: relp, dst: QUAR_NAME + '/' + basename(dst) });
}

// 处理一轮事件（这次的判定点）
function applyEvents(events, allowQuarantine) {
  for (const ev of events) {
    if (ev.kind === 'delete') {
      const proj = projectFor(join(ROOT, ev.relp), ROOT);
      log({ event: 'delete', project: proj && basename(proj), src: ev.relp });
      continue;
    }
    const srcAbs = join(ROOT, ev.relp);
    const proj = projectFor(srcAbs, ROOT);
    if (!allowQuarantine) continue;
    if (!proj) continue; // 根上/根外不审
    if (!existsSync(srcAbs)) continue;
    if (!hasPassVerdict(proj, TTL_MS)) quarantine(srcAbs, ev.relp);
  }
  // 补试上次没挪成的
  if (allowQuarantine) {
    for (const relp of [...pendingRetry]) {
      const abs = join(ROOT, relp);
      if (existsSync(abs) && !hasPassVerdict(projectFor(abs, ROOT) ?? abs, TTL_MS)) quarantine(abs, relp);
    }
  }
}

// 自动还原：verdict 落地后，把该项目的隔离文件搬回去
function restoreProject(projName) {
  if (!existsSync(AUDIT())) return;
  const recs = readFileSync(AUDIT(), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const restored = new Set(recs.filter((r) => r.event === 'restore').map((r) => r.src));
  for (const r of recs) {
    if (r.event !== 'quarantine') continue;
    if (restored.has(r.src)) continue;
    if (projName !== 'all' && r.project !== projName) continue;
    const srcAbs = join(ROOT, r.src);
    if (existsSync(srcAbs)) {
      log({ event: 'restore-conflict', project: r.project, src: r.src, detail: '原位已被占用，留在隔离区' });
      continue;
    }
    try {
      mkdirSync(dirname(srcAbs), { recursive: true });
      renameSync(join(ROOT, r.dst), srcAbs);
    } catch (err) {
      log({ event: 'restore-failed', project: r.project, src: r.src, detail: err.message });
      continue;
    }
    log({ event: 'restore', project: r.project, src: r.src });
  }
}

function autoRestorePublished() {
  if (!existsSync(AUDIT())) return;
  const projs = new Set(
    readFileSync(AUDIT(), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l).project;
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  );
  for (const p of projs) {
    const dir = join(ROOT, p);
    if (existsSync(dir) && hasPassVerdict(dir, TTL_MS)) restoreProject(p);
  }
}

// ---------- 报告 ----------
function listQuarantine() {
  if (!existsSync(AUDIT())) return console.log('[watchdog] 隔离区为空');
  readFileSync(AUDIT(), 'utf8')
    .split('\n')
    .filter(Boolean)
    .forEach((l) => {
      try {
        const r = JSON.parse(l);
        if (r.event === 'quarantine') console.log(`  ${r.ts} · ${r.project} · ${r.src} → ${r.dst}`);
      } catch {}
    });
}

function statusReport() {
  if (!ROOT || !existsSync(ROOT)) return console.error('[watchdog] 真工程根不存在');
  let projs = new Set();
  for (const e of readdirSync(ROOT, { withFileTypes: true })) {
    if (e.isDirectory() && !IGNORE.has(e.name)) projs.add(e.name);
  }
  console.log(`真工程根: ${ROOT}`);
  if (projs.size === 0) return console.log('  （无项目）');
  for (const p of projs) {
    const ok = hasPassVerdict(join(ROOT, p), TTL_MS);
    console.log(`  ${ok ? '🔓 放行' : '🔒 锁定'} · ${p}`);
  }
}

function printHelp() {
  console.log(`判词锁守护进程（agent 无关的文件系统门控）
用法:
  node arena/watchdog.mjs                常驻监视（fs.watch + 轮询）
  node arena/watchdog.mjs --once         跑一轮即退（配任务计划保活/兜底）
  node arena/watchdog.mjs --root <dir>   覆盖真工程根（测试/沙箱）
  node arena/watchdog.mjs --restore all  还原隔离文件（或 --restore <项目名>）
  node arena/watchdog.mjs --list         列出隔离区
  node arena/watchdog.mjs --status       门控状态总览
常驻与定时 --once 二选一，别同时跑。`);
}

// ---------- 主体 ----------
function tick(prev, allowQuarantine) {
  const curr = walk(ROOT, new Map());
  const events = prev ? diff(prev, curr) : [];
  if (events.length) applyEvents(events, allowQuarantine);
  saveBaseline(curr);
  if (allowQuarantine) autoRestorePublished();
  return curr;
}

function runOnce() {
  const prev = loadBaseline();
  // 无基线 = 冷启动：只打基线，不冤枉存量的合法文件
  tick(prev, !!prev);
}

function runDaemon() {
  let prev = loadBaseline();
  prev = tick(prev, !!prev);
  console.log(`[watchdog] 判词锁守护运行中 · 监视 ${ROOT} · 轮询 ${POLL_MS}ms · Ctrl+C 退出`);

  let debounce = 0;
  try {
    watch(ROOT, { recursive: true }, () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = 0;
        try {
          prev = tick(prev, true);
        } catch (err) {
          console.error('[watchdog] poll 出错:', err.message);
        }
      }, 300);
    });
    console.log('[watchdog] fs.watch 生效（回应式轮询）');
  } catch {
    console.log('[watchdog] 本平台不支持 recursive watch，退化为纯轮询');
  }

  setInterval(() => {
    try {
      prev = tick(prev, true);
    } catch (err) {
      console.error('[watchdog] poll 出错:', err.message);
    }
  }, POLL_MS);

  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
    console.log(`[watchdog] 收到 ${sig}，已停。隔离区文件保留在 ${QUAR_NAME}/。`);
    process.exit(0);
  });
}

function main() {
  if (args.help) return printHelp();
  if (!ROOT || !existsSync(ROOT)) {
    console.error(`[watchdog] realWorkspaceRoot 不存在: ${ROOT ?? '(未配置)'}`);
    process.exit(1);
  }
  if (args.list) return listQuarantine();
  if (args.status) return statusReport();
  if (args.restore) return restoreProject(args.restore);
  if (args.once) return runOnce();
  runDaemon();
}

main();