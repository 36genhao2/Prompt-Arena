# 桌面文件归类脚本 · desktop-file-sorter（定稿 v1）

| 要素 | 内容 |
| --- | --- |
| 任务 | 写一个 Python 脚本，把「源目录」里的文件按扩展名归类到 images / docs / videos / others 四个子文件夹 |
| 目标 | 可测：dry-run 预报与实跑结果一致；跑完能用自检脚本证明每类移动数量 |
| 约束 / 红线 | 不删除任何文件；只移动不改名；不处理子文件夹；不碰平级内 `.` 开头隐藏文件（.env/.gitignore 等）；无扩展名文件一律跳过；空目录不建 |
| 架构 | 单脚本 + 配置 + 测试夹具，四方交付（改动落点见下） |

## 交付物（改动落点）

1. `sort_files.py` —— 主脚本。

   - 命令：`python sort_files.py --target <目录> [--dry-run] [--extensions-file 路径]`
   - `--dry-run`：只打印移动计划，不实际移动。
   - 扩展名比较统一转小写（`.PNG` = `.png`）；重名自动加 `_1`/`_2` 后缀，禁止覆盖。
2. `extensions.json` —— 品类→扩展名映射（可改；用户加 `epub→books` 直接编辑此文件；或 `--extensions-file` 换别份）。默认：
   - images：jpg/jpeg/png/gif/bmp
   - docs：pdf/doc/docx/xls/xlsx/txt/md
   - videos：mp4/mkv/avi
   - 其余一律 others
3. `tests/sample_fixture/` —— 含 10 个混类文件的样例目录（含一个大写扩展名、一个无扩展名、一个 `.env`，验证边界）。
4. `verify.py` —— 一键自检：对样例目录跑 dry-run 断言预报、跑实移断言落位与计数。

## 验收标准（做完拿什么证明）

- [ ] `python sort_files.py --target tests/sample_fixture --dry-run` 输出计划，且样例目录零变化
- [ ] `python verify.py` 全绿（实移后落位正确、数量对、重名不覆盖）
- [ ] 其余扩展名落进 others；无扩展名与 `.env` 未被移动
- [ ] 用户改 `extensions.json` 加一类后无需改代码即生效