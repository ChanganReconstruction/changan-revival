# 绘图器输入格式

每个坊市在 `data/` 下放两类文件：**`.geojson` 写画什么、画在哪；`manifest.json` 写用哪个文件出哪张图。** 普通要素只需填几何和五个必填属性；要在图上显示名字时再填 `name`。

## 1. GeoJSON：画什么

下面是可直接使用的 [`ward.geojson`](examples/ward.geojson) 示例。出处编号和坐标仅作示例：假设南门有直接记载，但具体门位只能示意。

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [10, 20]},
      "properties": {
        "id": "gate-south",
        "type": "gate",
        "source": "S01",
        "grade": "A",
        "inference": "schematic",
        "name": "南门"
      }
    }
  ]
}
```

### 坐标和几何

- 坐标是局部平面上的 `[x, y]`，不是经纬度或像素。有明确朝向的平面图约定 `x` 向东、`y` 向北。只有前后、内外关系的示意图不必承诺地理朝向。
- 点 `Point` 用 `[x, y]`；线 `LineString` 用 `[[x1, y1], [x2, y2], ...]`，至少两点；面 `Polygon` 用 `[[[x1, y1], ... , [x1, y1]]]`，每个环首尾相同且至少四项（含重复的末点）。
- 绘图器不会根据「在某隅」「邻某宅」推算建筑坐标。只知某隅时可用 `layer: "zone"` 表达大致范围，不画精确宅界；不能落位的对象写入未落位清单（如 `unplaced.csv`）。关系图可用 `layer: "label"` 只画文字，这时坐标仅表示排字位置，不代表建筑点位、距离或尺度。

### 必填属性

| 字段 | 填什么 |
| --- | --- |
| `id` | 要素标识，同一个 GeoJSON 文件内唯一。 |
| `type` | 对象类别，如 `gate`（门）、`temple`（寺）、`street-cross`（十字街）。绘图器据此选默认绘制层。 |
| `source` | 可回查的出处编号或引用。 |
| `grade` | 史料等级：`A` 直接记载，`B` 居第可证，`C` 仅提及，`D` 不可用。不是坐标精度。 |
| `inference` | 图上几何的依据：`documented` 有记载（实线），`likely` 较可能（长虚线），`alternative` 备选（短虚线），`schematic` 示意（点线），`typological` 类型学补足（细点线）。类型学补足要在 `source` 指明参照，并在 `note` 说明，不当作本址记载。 |

### 按需填写

- **绘制层 `layer`**：省略时与 `type` 同值，但 `ward-boundary` 归到 `ward`，`street-external`、`street-cross`、`street-lane` 归到 `street`。显式填写优先，例如 `type: "temple"` 配 `layer: "label"` 只标寺名，配 `layer: "zone"` 只画大致范围。可选绘制层见 [Schema](schema/ward.schema.json)；原来已写的 `layer` 不需要删除。
- **文字和说明**：`name` 是要素名；需要用不同的图面短名时填 `label`；`note` 记录解释或限制。
- **考证补充**：`position_precision` 记录落位精度（如 `adjacent` 邻近、`quadrant` 某隅、`point` 点位）；`period`、`tianbao_visible` 记录年代和天宝时段判断。填这些字段不会让绘图器自动推断坐标或筛掉要素。
- **结构和道路**：`parent` 填父要素 `id`；道路可填 `width`（与坐标同单位的正数）、`width_basis`（宽度依据）、`street_class`（道路层级）。不为出图编造宽度。
- **图面特例**：`labelPoint` 仅在默认标注位置不合适时覆盖；`label_priority`、`label_kind`、`size_class` 等不必填入普通模板。尺寸线可用 `layer: "dimension"`；尺寸读数用 `name`、`labelPoint` 和 `label_kind: "dimension"`。

## 2. manifest.json：出哪张图

最小 PNG 清单 [`manifest.json`](examples/manifest.json)（与上述 `ward.geojson` 放在同一目录）：

```json
{
  "ward": "example",
  "outputs": [
    {"id": "ward-plan", "input": "ward.geojson", "title": "坊门示意"}
  ]
}
```

- `ward` 是坊市标识；`outputs` 至少一条。每条必填 `id`、`input` 和 `title`。`id` 在同一清单内唯一，使用小写字母、数字和连字符；PNG 文件名为 `<id>.png`。`input` 相对清单所在目录，可以指向 `courtyards/` 下的文件。
- `subtitle` 和 `note` 可选。已用米制坐标才写 `"unit": "米"`；不按比例的关系示意不填 `unit`，不画比例尺。方位未定时用 `"north": false` 不画指北针。
- **PNG 不用填像素尺寸、颜色或输出路径。** 绘图器决定画布尺寸，按 `inference` 画线型和灰阶。`output` 和 `size` 仅供旧版 SVG 使用：`output` 相对清单所在目录，`size` 不填则为 `1200 × 900`。

## 3. 校验和实例

从仓库根目录校验，不生成图片：

```bash
pnpm render:ward --manifest scripts/ward-render/examples/manifest.json --check
```

生成命令和 PNG 路径见[绘图器使用指南](README.md)。
