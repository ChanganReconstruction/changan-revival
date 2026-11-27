# 安仁坊平面数据

## 本版图源与预览

- `ward.geojson`：750 年参照的坊级平面示意。坊框按《唐两京城坊考》所引吕大临《长安图》“皇城以南九坊，南北各三百五十步”“朱雀街东第一坊，东西三百五十步”，按 1 步≈1.47 米折算为约 `514.5×514.5 米`。此数不是实测；展示介绍与博客的 `562×540 米` 说见汇编 A1.2，待核。
- `manifest.json`：渲染清单，输出 `ward-plan`。
- `unplaced.csv`：A2 中不能落入本期图面的对象。`quadrant` 表示只知某隅、图上仅以 zone 或注记示意；`unplaced` 表示方位未记；`pending` 表示出处、年代或本期存续待核；`late-tang` 表示中晚唐等异期材料，不用于 750 图。

从仓库根目录校验数据（不写图）：

```bash
pnpm render:ward --manifest reconstructions/changan-tianbao/anren/data/manifest.json --check
```

生成本地 PNG：

```bash
pnpm render:ward --manifest reconstructions/changan-tianbao/anren/data/manifest.json --id ward-plan --png-dir build/figures/agent/preview/anren
```

或按默认路径生成：

```bash
pnpm render:agent --id ward-plan
```

- [安仁坊总图（本地 PNG）](../../../../build/figures/agent/changan-tianbao/anren/ward-plan.png)

![安仁坊 · 天宝九载坊市平面分布示意](../../../../build/figures/agent/changan-tianbao/anren/ward-plan.png)

PNG 与缓存不入 Git。校验通过不等于验图；使用前须打开 PNG 检查文字、压线、比例与图例。

## 坐标与字段

- 局部平面坐标，`x` 向东、`y` 向北；单位米。坊界外框 `0–514.5 × 0–514.5`。西侧朱雀大街画到 `x=-130`，北侧第七横街画到 `y=538.1`，仅为表达相邻关系，不是实测范围。
- 图面另有东西、南北两条 `514.5 米` 尺寸线，以及四隅和“仅东西二门”注记；尺寸线按 350 步说换算，属图面说明，不是考古测量值。
- 必填属性：`id`、`type`、`grade`、`inference`、`source`。`layer` 选填；本图显式填写，避免 `type` 与绘制层混淆。
- `grade`：A 直接记载或实测 / B 居第、位置可证 / C 仅提及或旁证 / D 不可用。`grade` 只表史料等级，不表坐标精度。
- `inference`：`documented` 实线 / `likely` 长虚线 / `alternative` 短虚线 / `schematic` 点线 / `typological` 细点线。线型表示几何依据，不表示史料等级。
- `position_precision`：`gate` / `street` / `adjacent` / `quadrant` / `point` / `schematic` / `none`。
- `period`：`sui` / `early-tang` / `high-tang` / `late-tang`。中唐材料在 CSV 中可写 `mid-tang`，GeoJSON 不写该值。
- `tianbao_visible`：`yes` / `no` / `unknown`。图上以 `†` 标天宝存续待核；`‡` 标异期，本期图面不画。
- 道路用 `street_class` 区分 `external` / `cross` / `lane`，`width_basis` 说明宽度依据。
- `layer: "zone"` 只表示某隅的大致范围，不是宅界或院界；`layer: "label"` 只用于排字，不画几何轮廓。

`unplaced.csv` 的 `status`：

| 值 | 含义 |
| --- | --- |
| `quadrant` | 只知在某隅，图上用 zone 或注记，不画宅界 |
| `unplaced` | 方位未记，不落位 |
| `pending` | 出处、年代或本期存续待核，不画 |
| `late-tang` | 中晚唐等异期材料，不进 750 图 |

## 本图明确不画

- 不画北门、南门：文献称皇城以南诸坊“各东西二门”，《雍录》称“坊北无门”；2021–22 年北墙角门是便门，不是正式坊门。
- 不画王昕宅、刘延景宅、万春公主宅、章仇兼琼宅、杜佑旧第：或仅知“坊西南/东南隅”而本期存续待核，或仅知在坊，均不进本期图面空间区。
- 不画元载、张孝忠、崔造、于頔、元稹、唐俭、庞卿恽等异期宅第；见 `unplaced.csv` 与汇编 A2。
- 不画西南隅宅邸的 10 个房址、长廊、院墙：完整发掘平面未公开发表，现有图多为展示馆设计方遗址分布图或现场照片，不能量取院宽、院数或房址尺寸。
- 不画塔院院界、塔位、门塔距：只知在西北隅、院门北开；院内布局未定。

## 与汇编的关系

本目录只提供程序化图源与未定位清单；证据分级、诸说并列、详条与引用总目见[《安仁坊复原资料汇编》](../README.md)。图上每一主张均可从 `source` 回到汇编 C1；`source` 中的 `AR-S18` 指荐福寺浮图院专项[《荐福寺浮图院》](../../jianfu/README.md)。
