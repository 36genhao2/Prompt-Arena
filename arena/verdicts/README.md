# arena/verdicts — 判词锁运行时状态

判决 PASS 时由引擎写入 `<slug>.verdict.json`（判定词锁解锁 token）。命中文件被 `.gitignore` 排除，不入库。格式：

```json
{
  "slug": "<slug>",
  "verdict": "PASS",
  "targetProject": "<真工程绝对路径>",
  "judgedAt": 1700000000000,
  "ttlMs": 86400000
}
```

`PreToolUse` hook（`.claude/hooks/verdict-lock.mjs`）据此放行 / 拦截对真工程根的写入。