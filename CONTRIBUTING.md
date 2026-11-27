# 协作约定

1. 开始前先在议题中说明复原对象、时期和工作范围，避免重复认领。
2. 提交时注明史料出处，尽量标到卷页、图版或报告编号；注明外部资料的来源和使用许可。
3. 将实证、推断和假设分开写。有分歧时保留备选方案和各自依据。
4. 在拉取请求中说明改了什么、依据是什么、还有哪些问题待验证。大模型和原始扫描件先不要直接提交到 Git。

## 分支与 PR

固定成员在同一个 GitHub 仓库协作，有仓库写权限即可自行创建任务分支。不为个人或模块保留长期分支。没有写权限的外部贡献者，可以在仓库设置允许时通过 fork 提交 PR。

- `dev` 是日常协作和联调分支：任务经过审阅后合入，可供下游试用。
- `main` 是正式交付分支：由交付负责人将已完成联调和验收的一批成果从 `dev` 合入。
- `dev` 和 `main` 均通过 PR 合并，不直接推送。

### 日常任务：任务分支 → `dev`

1. 从最新的 `dev` 创建分支，例如 `research/pingkang-basemap`、`geometry/pingkang-blockout` 或 `visual/pingkang-materials`。一项可独立审阅的任务用一条分支。
2. 推送分支后，在 GitHub 开 PR，把目标分支（`base`）选为 `dev`。写明改了什么、如何验收、还有哪些待验证项。涉及跨组交付时，附上固定的资产版本和链接、所依据的上游版本，以及必要的导入说明。不要只写“基于 `dev` 最新版”。
3. 请至少一位相关成员审阅。例如，几何改动涉及坊界或建筑形制时，请研究成员核对；首次交付白模或变更导出格式时，请视觉成员试导入。
4. 审阅通过后合入 `dev`，再删除任务分支。任务 PR 可以使用 **Squash and merge**。

### 正式交付：`dev` → `main`

联调和验收通过后，由交付负责人开 PR，来源分支选 `dev`，目标分支选 `main`，写明交付范围、资产版本和验收结果。使用 **Create a merge commit**，不要 squash，以保留两条长期分支之间的合并历史。

## 开发工具版本

只编辑复原文档不需要安装 Node.js、pnpm 或 Biome。

修改 JS/TS 代码或工具配置前，用版本管理器切换到 `.node-version` 中的 Node.js 版本，并使用 `package.json` 的 `packageManager` 指定的 pnpm 版本。`.node-version` 本身不会切换当前终端使用的 Node.js。

```sh
node -v   # v26.13.1
pnpm -v   # 12.21.0
pnpm install --frozen-lockfile
pnpm check
```

Biome 由项目依赖提供，不用全局安装。`pnpm check` 只检查，不修改文件；需要格式化时运行 `pnpm format`。Biome 不处理 Markdown、MDX 或 `reconstructions/` 中随复原文档交付的 SVG。

升级工具时，在同一个拉取请求中更新相关版本声明、配置和锁文件。
