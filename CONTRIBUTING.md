# 协作约定

1. 开始前先在议题中说明复原对象、时期和工作范围，避免重复认领。
2. 提交时注明史料出处，尽量标到卷页、图版或报告编号；注明外部资料的来源和使用许可。
3. 将实证、推断和假设分开写。有分歧时保留备选方案和各自依据。
4. 在拉取请求中说明改了什么、依据是什么、还有哪些问题待验证。大模型和原始扫描件先不要直接提交到 Git。

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
