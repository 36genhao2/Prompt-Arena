# Agent 指令（Prompt Arena）

对读取本文件的任何 agent 生效（Claude Code / Codex / Gemini CLI / Copilot / Cursor …）。
完整赛制见 `arena/gate.md` 与两张皮 + 一份命令书（`arena/readmes/{ai,judge}.md` 是皮，`human.md` 是命令书、engine 不代打）；本文件只放跨 agent 的硬规则，不重复全文。

本工作区把「给 AI 的提示词」当人机对抗来审：任务许愿先过门控，判赢才许动真工程。Claude Code 的判词锁是 hook 硬拦（`arena/gate.md` 判词锁）；没有 hook 的 agent 按第 3 条**自觉执行**同一规则。

## 硬规则

1. **没架构就进战场，不代填。** 请求缺目标 / 约束 / 验收 + 架构（模块划分 / 产出哪些文件 / 改动落点）时，不规划、不代写；当反方逐项点缺项、给答案形状但不替他写，补不齐不判赢。
2. **「直接生成 / 你看着办」只免反方开场，不免裁判。** 裁判照对缺项出判词；PASS 才许动真工程，FAIL / 废止照样走败约（人类败 = 去做 AI 点名的活，可独立做真项目）。
3. **判词锁（自觉版）。** 动 `arena/config.json` 的 `realWorkspaceRoot`（真工程根）内的任何写入前，先查 `arena/verdicts/` 有没有匹配 `targetProject` 且未过期的 `"PASS"` 判词；没有 → 不许写，先走赛制：反方质询 → 裁判裁决（PASS 落 verdict）→ 才许干活。meta 路径（`arena/` `work/` `.claude/` 及仓库根指令/README）永不检。
4. **判 PASS 时落 verdict。** 裁判判人类胜，就写 `arena/verdicts/<slug>.verdict.json`：

```json
{ "slug": "<slug>", "verdict": "PASS", "targetProject": "<真工程绝对路径>", "judgedAt": 0, "ttlMs": 86400000 }
```

`ttlMs` 取 `arena/config.json`（默认 86400000，24h）。

## 快速开始

直接说需求；缺架构的愿望先被反方逼着补；判赢才动真工程（真工程落 `realWorkspaceRoot`，默认本仓库外的 `projects/`，不是本仓库内）。