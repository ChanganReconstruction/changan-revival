# 宣阳坊平面数据

## 本版图源与预览

- `ward.geojson`：750 年参照的坊级平面示意。坊框按《唐两京城坊考》所引吕大临《长安图》“皇城左右共七十四坊……广各六百五十步”取东西 650 步；南北 350 步参照同街平康坊及皇城以南九坊推定。按 1 步≈1.47 米折算约 **955.5×514.5 米**。东西有直接记载，南北是推导，不是本坊实测。
- `manifest.json`：渲染清单，输出 `ward-plan`。
- `unplaced.csv`：A2 中不能落入本期图面的对象。`quadrant` 表示只知某隅、图上仅以 zone 或注记示意；`unplaced` 表示方位未记；`pending` 表示出处、年代或本期存续待核；`late-tang` 表示中晚唐等异期材料，不用于 750 图。
- 本坊没有正式考古发掘简报；坊墙、门址、十字街宽度、院界均未落实。图上的坊界、墙、门、街、zone 都是示意。

从仓库根目录校验数据（不写图）：

```bash
pnpm render:ward --manifest reconstructions/changan-tianbao/xuanyang/data/manifest.json --check
```

生成本地 PNG：

```bash
pnpm render:ward --manifest reconstructions/changan-tianbao/xuanyang/data/manifest.json --id ward-plan --png-dir /tmp/opencode/xuanyang
```

或按默认路径生成：

```bash
pnpm render:agent --id ward-plan
```

- [宣阳坊总图（本地 PNG）](../../../../build/figures/agent/changan-tianbao/xuanyang/ward-plan.png)

![宣阳坊 · 天宝九载坊市平面分布示意](../../../../build/figures/agent/changan-tianbao/xuanyang/ward-plan.png)

PNG 与缓存不入 Git。校验通过不等于验图；使用前须打开 PNG 检查文字、压线、比例与图例。

## 坐标与字段

- 局部平面坐标，`x` 向东、`y` 向北；单位米。坊界外框 `0–955.5 × 0–514.5`。西侧启夏门街画到 `x=-15`，北侧平康—宣阳间街画到 `y=543.5`，东侧东市西街画到 `x=1102.5`，南侧亲仁坊北街画到 `y=-15`；这些外街只表达相邻关系，不是实测范围。
- 图面另有东西 955.5 米、南北 514.5 米两条尺寸线，以及四隅、门、街、邻坊和东市注记；尺寸线按 650×350 步折算，属图面说明，不是考古测量值。
- 必填属性：`id`、`type`、`grade`、`inference`、`source`。`layer` 选填；本图显式填写，避免 `type` 与绘制层混淆。
- `grade`：A 直接记载或实测 / B 居第、位置可证 / C 仅提及或旁证 / D 不可用。`grade` 只表史料等级，不表坐标精度。
- `inference`：`documented` 实线 / `likely` 长虚线 / `alternative` 短虚线 / `schematic` 点线 / `typological` 细点线。线型表示几何依据，不表示史料等级。
- `position_precision`：`gate` / `street` / `adjacent` / `quadrant` / `point` / `schematic` / `none`。
- `period`：`sui` / `early-tang` / `high-tang` / `late-tang`。中唐材料在 CSV 中可写 `mid-tang`，GeoJSON 不写该值。
- `tianbao_visible`：`yes` / `no` / `unknown`。图上以 `†` 标天宝存续待核；`‡` 标异期，本期图面不画。
- 道路用 `street_class` 区分 `external` / `cross` / `lane`，`width_basis` 说明宽度依据。坊墙用 `layer:"ward-wall"`、`width`、`width_basis`。
- `layer:"zone"` 只表示某隅或某门旁的大致范围，不是宅界、院界或地块边界；`layer:"label"` 只用于排字，不画几何轮廓。

`unplaced.csv` 的 `status`：

| 值 | 含义 |
| --- | --- |
| `quadrant` | 只知在某隅，图上用 zone 或注记，不画宅界 |
| `unplaced` | 方位未记，不落位 |
| `pending` | 出处、年代或本期存续待核，不画 |
| `late-tang` | 中晚唐等异期材料，不进 750 图 |

## 图面要素

- **坊界**：`XY-WARD`，0–955.5×0–514.5 米，`grade B`、`inference likely`。
- **坊墙**：8 段，厚 3.5 米，门洞各留 30 米。墙厚据平康—宣阳间街道论坛转引，原报告未核；门洞宽为图面开口，不是实测。
- **四门**：南、北、西、东各一，`grade A`，`inference schematic`。东门由李济物宅、西门由韦巨源/高仙芝宅、南门由窦毅宅、北门由韩公武宅条推知；门址未发掘。
- **十字街**：东西、南北两街各宽 15 米，`inference likely`，`width_basis schematic`；街宽、线位未记。
- **外街**：北侧平康—宣阳间街宽 29 米（转引待核）；东侧东市西街宽 147 米（《长安志》东市“四面街各广百步”，按 1 步≈1.47 米）；西、南两侧只画线位，宽度未得。
- **zone（11 组）**：万年县廨（东南隅）、净域寺（西南隅）、郭元振宅（东北隅）、李诲宅（十字街西北）、韦巨源宅等（西门之北）、李乂宅等（十字街东北）、高仙芝宅（西门之南）、窦毅宅/杞公庙（南门之西）、李济物宅（东门之北）、杨国忠宅/虢国宅（相对位置待核）、独孤明宅（近净域寺）。
- **尺寸线**：东西 955.5 米、南北 514.5 米；南北 350 步为推导，注记已说明。

## 本图明确不画

- 不画院界、宅界、建筑单体、房址、门屋、厅堂、塔位、树石、水系：本坊无考古平面，文献也不给院界。
- 不画韩公武宅、韦文恪宅、张议潮宅、奉慈寺、郭暧宅、四进奏院、榷盐院：或明确异期，或设置年/存续不能确认，见 `unplaced.csv`。
- 不画陈子昂宅、常无名宅、贾昌宅、彩缬铺、韩国/秦国夫人宅：仅知在坊或无有效坊内方位。
- 不画“杨国忠宅占八分之一坊”或“十字街东南角西半部”的确定地块：王南说只作备一说；图面只画相对位置示意区，`inference:"alternative"`。
- 不画坊内巷格：韦巨源宅条“次西北隔巷”只证巷的存在，不证走向、宽度。
- 不画东市内部、平康坊内部、亲仁坊内部、崇义坊内部。

## 与汇编的关系

本目录只提供程序化图源与未落位清单；证据分级、诸说并列、详条与引用总目见[《宣阳坊复原资料汇编》](../README.md)。图上每一主张均可从 `source` 回到汇编 C1；`source` 中的 `XY-S17` 是论坛转引考古数据，`XY-S14` 是田雨嘉、张文轩二手论文，`XY-S16` 是王南笔记，均只作线索或备一说。

## 版本

- v0.1（2026-11-28）：初版。坊框 650×350 步；四门、十字街、11 组 zone、外街、尺寸线；异期与仅坊对象入 `unplaced.csv`。
