# Prompt Arena · 人机对抗提示词工程

> Don't throw wishes. Fight for the prompt.

一个把**提示词优化**当**人机对抗**来做的 AI 工作区。任务提示词不是丢给 AI 的许愿纸条，而是要先上这台织机：

1. **反方质询** —— 你的许愿缺架构？AI 当反方直接碾：缺目标？缺模块清单？改动落点模糊？一次只点一个最卡的缺项、给答案形状但不替你想，逼你亲口补出来。
2. **裁决** —— 裁判（同一个 agent 换皮）判**「人类胜 / 人类败」**，不给你打分数。
3. **换岗** —— 人类败，就去做 AI 点名的活：搭架构回来重战，**或自己独立做真项目（写代码 / 产出文件）**；AI 败，就照人类命令立规矩。
4. **判词锁** —— 只有裁判判赢并落了 verdict 文件，才许动真工程根里的项目。
5. **干活** —— 产物落在你的真工作区（仓库外），且干活时 AI 仍带反骨。

核心理念是"人机版 GAN"：同一套引擎，加载 `ai.md` 就是 AI、加载 `human.md` 就是人类、加载 `judge.md` 就是裁判——**同一个 agent，三张皮互相碾压**。败北一局不长记性，**`decrees/` 里就多一条令**：皮管人格，令管记忆，输了的人/机下一场带着令再战。

## 它是什么 / 不是什么

- 是：一个逼你把抽象许愿练成"有架构、可验收"提示词的工作区；AI 反过来教 / 攻 / 命令你。
- 不是：辩论小游戏；不是输出"优美 prompt"的水词工具；不是一味顺从的助手。

## Status

**v0 机制原型 · 未经过真实用户验证**

- 机制闭环（点化 → 质询 → 裁决 → 换岗 → 判词锁）已通过**演示对局**跑通，
  但所有示范战均为**作者自导自演**，尚无真实用户实战数据。
- `attacks/`、`decrees/` 里的条目目前由作者编写，**尚未由真实对局产生复利**。
- **`verdict-lock.mjs` hook 未经充分测试**：它会拦截配置的真工程根目录的写入，
  请勿在关键工程里直接启用。
- 适合：试验、研究、提 issue 反馈。
- 不适合：作为关键工程的依赖。

## 快速开始

1. 把这个目录放进 Claude Code 工作区（顶层 `CLAUDE.md` 常驻门控）。
2. 直接说需求 —— 缺架构的愿望直接进战场被反方逼着补；或者显式 `+ /prompt-gate`。
3. 产物落 `work/prompts/`（定稿）、`work/reports/`（判词/战报）、`work/tasks/`（演练产物）；**真工程产物落 `arena/config.json` 指定的真工作区（仓库外）**。

## 架构：一个引擎 + 三张皮 + 一道门

控制平面（全是 md）：

| 文件 | 角色 |
| --- | --- |
| `arena/engine.md` | 引擎契约 —— 同一个 agent，回合决定加载哪张皮 |
| `arena/readmes/ai.md` | AI 皮：反方 / 点名 / 立规矩 / 干活（逆来逆往） |
| `arena/readmes/human.md` | 人类皮：生产工艺 / 辩护 / 换岗 |
| `arena/readmes/judge.md` | 裁判皮：判人类胜 / 人类败 |
| `arena/gate.md` | 赛制：反方质询→裁决→换岗→判词锁干活，轮数上限 2 |
| `arena/decrees/` | 败方令 · 累计库：输一次长一令，皮管人格、令管记忆 |
| `arena/attacks/` | 攻击库：红队弹药库，新立论先撞库 |
| `arena/config.json` | 真工作区根 + verdict TTL |
| `.claude/hooks/verdict-lock.mjs` | 判词锁 PreToolUse hook（无 PASS verdict 拦真工程写入） |
| `.claude/skills/prompt-gate/` | `/prompt-gate` 显式撞门 |

## 目录结构

```
Prompt Arena/
├── CLAUDE.md                 # 常驻门控硬规则
├── arena/
│   ├── engine.md             # ★ 单引擎换皮契约
│   ├── gate.md               # ★ 赛制
│   ├── readmes/              # 三张皮（ai/human/judge）
│   ├── decrees/              # ★ 败方令累计库（ai.md / human.md）
│   ├── attacks/              # ★ 攻击库（红队弹药库）
│   ├── config.json           # 真工作区根 + verdict TTL
│   └── verdicts/             # 判词（判词锁解锁 token，gitignore）
├── .claude/
│   ├── skills/prompt-gate/   # /prompt-gate 技能
│   └── hooks/verdict-lock.mjs# 判词锁 hook
├── work/
│   ├── prompts/              # 通过门控的定稿
│   ├── reports/              # 判词与战报
│   └── tasks/                # 执行产物
└── README.md
```

## Roadmap

**已落地**：攻击库（`arena/attacks/`，A-01~A-14 共 14 条架构洞模式，反方开打先撞库）；败方令累计库（`arena/decrees/`，附着 gate 第 3 段败约，输一次长一令）；**判词锁**（`arena/verdicts/` + PreToolUse hook，只有判 PASS 才许动真工程）；示范战闭环跑通（人类败 / 人类胜 / 废止三条线，见 `work/reports/`）。

**待做**：
- **换岗实例库**：人类替 AI 干活的真实样例。
- 硬模式：反方 / 裁判独立子代理，隔离更干净。
- Web 工台、人 vs 机对局记录与胜率榜、多模型同台。

## License

MIT（占位，发布前可改）。