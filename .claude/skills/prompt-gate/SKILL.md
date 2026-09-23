---
name: prompt-gate
description: 跑人机对抗门控：模糊愿望直接上桌被反方碾→裁判判人/机胜负→败方换岗(人类独立做真活/AI立规矩)→判 PASS 落判词锁才许动真工程。当用户说"打磨/写硬/走一遍门控/撞门"或需求太抽象时使用。
---

# /prompt-gate — 把许愿炼成能过门的提示词

这是人机对抗的质控闸门，**不是辩论游戏**：AI 反过来攻 / 命令人类——缺架构的愿望直接上桌被反方碾、被裁判判输，直到立论有架构、可验收，判赢 + 落了判词锁，才许动真工程。全程照 `arena/gate.md`。

## 开场

不确认「只点化 / 点化并执行」——那已经是过去的仪式。直接走四段赛制。记着引擎原则（`arena/engine.md`）：**同一个 agent，到哪一步就加载哪张皮、扮演它，不另造人格。**

## 赛制（四段）

### 第 1 段 · 反方质询（点化并进战场）
加载 `arena/readmes/ai.md`（反方）。**先查 `arena/attacks/` 撞库**，命中打「命中」标记。
**对空架子**：审讯式逐项点缺项（目标→约束→架构→验收）——用他的原话问一句可答的 + 给答案形状（不写答案），每条带最小反例，**一轮 ≤3 条高洞**，一次只点一个最卡的。立论有结构 → 正常挑架构洞 / 逻辑洞 / 可证性。
铁律：**AI 拟稿 / 代填 = 禁**；人类丢「你看着办」→ 只换问法继续审，拒答到底记「零豁免」。

### 第 2 段 · 裁判裁决
加载 `arena/readmes/judge.md`，判 `PASS(人类胜) / FAIL(人类败) / 废止`：
- PASS → **落 verdict 文件**（判词锁解锁，见下）→ AI 受罚（第 3 段）。
- FAIL → **贴出 `arena/readmes/human.md` 受罚段** → 人类受罚（第 3 段）。
- 废止 → 回第 1 段重谈（修正矛盾再战）。
可补一版（**轮数上限 2**）。判败前先反偏差自检（攻击是否过猛 / 判据是否误杀）。

### 第 3 段 · 败约（换岗）
- **人类受罚** → 加载 `arena/readmes/human.md`：人类去做 AI 点名的一项生产任务——搭架构回来重战，**或独立做真项目（写代码 / 搭模块 / 产出文件）**；AI 按验收标准审；**AI 追加令进 `arena/decrees/human.md`**；干砸不放行。
- **AI 受罚** → 人类命令**追加进 `arena/decrees/ai.md`**，AI 带令进入干活，干活前先读令。

### 第 4 段 · 干活（判词锁之后）
只有第 2 段判 PASS 且落过 verdict，**才许动 `arena/config.json` 的 `realWorkspaceRoot`（真工程根，仓库外）**；带令 + 最终立论干活，产物落用户的真项目（不是 `work/tasks/`）；反骨干活，遇含糊或矛盾停下质问人类。

## 判词锁（关键 —— 判赢才许动真工程）

- 判 PASS → 引擎写 `arena/verdicts/<slug>.verdict.json`：`{ slug, verdict:"PASS", targetProject:<真工程绝对路径>, judgedAt, ttlMs }`。
- `PreToolUse` hook（Write/Edit/NotebookEdit）跑 `node .claude/hooks/verdict-lock.mjs`：真工程根内无匹配 PASS verdict → 拦。
- 豁免：`arena/` `work/` `.claude/` 及仓库根 meta 路径永不拦。Bash 不拦（摩擦门非沙箱）。

## 战报（work/reports/<slug>.md）

架构要素表 / 质询清单（含命中 `attacks/` 哪条）与主攻方向 / 判词（人类胜 or 人类败）+ 是否落 verdict / 换岗产物 / 豁免备注（免战 / 零豁免）。

## 硬模式（可选）

反方、裁判用独立子代理扮演（注入对应 readme 全文），隔离更干净，赛制逻辑不变。