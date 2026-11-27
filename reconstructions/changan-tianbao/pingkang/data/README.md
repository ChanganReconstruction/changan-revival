# 平康坊平面数据

## 本版图源与预览

- `ward-layout-review.geojson`：坊级总图试绘，画出坊门与路网的连通方案和对象占位；`†` 标天宝状态待核，`‡` 标异期旧址、晚唐方位或出土旁证。
- `courtyards/{puti-si,li-linfu,jia-you-guan,wan-an-guan}-review.geojson`：分别画钟楼方位、两堂前后、析宅置观、置观前两宅的东西关系；不代替完整院落平面。
- `unplaced-evidence.csv`：A2 中尚不能确认本期落位的线索。`unplaced` 不画；有方位的 `period-pending` 可作为旁证另标。CSV 不直接参与渲染。
- [`manifest.json`](manifest.json)：本版五张图的输入、输出名与版式配置。

从仓库根目录运行以下命令，生成[汇编 C2](../README.md#c2-图版目录)链接的五张 PNG，不生成新版 SVG。示意图形及标注坐标均不代表实地点位、距离或尺度。

```bash
pnpm render:ward --manifest reconstructions/changan-tianbao/pingkang/data/manifest.json \
  --png-dir build/figures/agent/changan-tianbao/pingkang
```

## 坐标与字段

- 坊图沿用 650 步 × 350 步坊框方案，`x` 向东，`y` 向北，不据图量取尺寸。院落关系图使用局部示意坐标；设置 `"north": false` 的图不按指北针解读。
- 必填属性：`id`、`type`、`grade`、`inference`、`source`。`layer` 选填；省略时由绘图器按 `type` 决定。
- `grade`：A 直接记载 / B 居第可证 / C 仅提及 / D 不可用。
- `inference`：documented 实线 / likely 长虚线 / alternative 短虚线 / schematic 点线 / typological 细点线。
- `inference: "typological"` 表示类型学补足，不是本址记载；必须用 `source` 指向参照对象，并在 `note` 说明“类型学补足”。
- `position_precision`：`gate` / `street` / `adjacent` / `quadrant` / `point` / `schematic` / `none`。
- 总图把只知在某隅的对象画为隅内示意点或占位块面，隅内位置未定；`layer: "label"` 不画几何轮廓。
- 道路用 `street_class` 区分 `external` / `cross` / `lane`，`width_basis` 说明宽度依据。
- 最小示例与通用字段见[绘图器输入格式](../../../../scripts/ward-render/FORMAT.md)和 [`ward.schema.json`](../../../../scripts/ward-render/schema/ward.schema.json)。

## 验证

PNG 不入 Git。按图生成及命名规则见[绘图器使用指南](../../../../scripts/ward-render/README.md)。本版不依赖 SVG。

校验全部数据（不写图）：

```bash
pnpm render:ward --manifest reconstructions/changan-tianbao/pingkang/data/manifest.json --check
```
