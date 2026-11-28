# 青龙寺塔院 · 平面数据

[返回总说明](../README.md) · [来源索引](../sources.md) · [塔基详条](../pagoda.md) · [单体卡](../buildings.md)

## 文件

- `ensemble-plan.geojson`：天宝九载（750）塔院正式平面。只覆盖 1、2、3、5、7 号遗址相关的中三门、塔基、塔心坑、金堂、月台、慢道、回廊、西配房；东院、北门、东塔院、窑址和寺界不在图内。
- `manifest.json`：生成 `ensemble-plan` PNG 的清单。`north: false`，因为图面只有项目坐标北，未作真北方位测量；`unit: "米"` 只用于有米制坐标的塔院图。
- 本目录不放 PNG。PNG 由绘图器写入 `build/figures/agent/changan-tianbao/qinglong/`，属于本地生成产物，不入 Git。

## 坐标

- 原点：塔院西南角 `(0, 0)`。
- `X` 向东，`Y` 向北，单位米；`Z` 不在此二维数据中，项目展示地坪为 `Z=0`，不是唐代标高。
- 塔院范围：`X=0–98`、`Y=0–132`。
- 图面上方为项目坐标北；未作考古坐标或地理坐标配准，不能把图上距离直接量到今日地形图。
- 塔基采用 15×15 米占位，边长来源为二手转引（[QL-S11](../sources.md#ql-s11)），不是已核实测；塔心坑 4×4 米、深 1.8 米。

## 图面约定

- `QL-01` 外框表示塔院范围/回廊外缘，不表示独立院墙，也不闭合寺界。
- `QL-02` 中三门只画夯土门基；2.94 米是残存南北宽度，不是原门屋进深。
- `QL-03` 塔基只画方形台基，`type` 借用 `hall` 是因为绘图器没有塔类，**不表示它是殿堂**；上部一律不画。
- `QL-03-PIT` 用 `layer: dimension` 画坑口细线，深度写在属性中，平面不按深度比例表现。
- `QL-04` 金堂只画台基，不画“十三间×五间、间距 4 米”的柱网；月台按尺寸画；慢道宽 3 米有据，西慢道为显示与西配房的已知相接关系而拉通（约 11.15 米），东慢道画 6 米，长度均非实测。
- `QL-05` 回廊是 3.33 米宽的带状分段，南廊在中三门处断开、西廊在西配房处断开；缺口是避让，不是门址以外的通道证据。
- `QL-06` 西配房取 8.40–10.09 米的中值 9.25 米示意；西南外扩未画。
- 标注点只表示排字位置，不表示建筑点位或距离；图面北向说明见清单 `note`，不画真北指北针。

## 校验与生成

从仓库根目录运行：

```bash
pnpm render:ward --manifest "reconstructions/changan-tianbao/qinglong/data/manifest.json" --check

pnpm render:ward --manifest "reconstructions/changan-tianbao/qinglong/data/manifest.json" \
  --png-dir "build/figures/agent/changan-tianbao/qinglong"
```

输出：`build/figures/agent/changan-tianbao/qinglong/ensemble-plan.png`。

## 读图限制

- 塔院 132×98 米、中三门 17×2.94 米、金堂 57.2×26.2 米、回廊宽 3.33 米、西配房 22.57×8.40–10.09 米等为 [QL-S08](../sources.md#ql-s08) 转引的发掘尺寸；原报告 [QL-S06](../sources.md#ql-s06)、[QL-S07](../sources.md#ql-s07) 未核，测点起止未逐项说明。
- 塔基 15 米、塔基—金堂 47 米、中三门—塔基 23.4 米是本版选定的可替换序列；报告另见 43 米、82 米等不一致口径，详见 [README A4 待查](../README.md#a4-复原方案与取值) 和 [pagoda.md](../pagoda.md#11-数字口径)。
- 图中没有木塔层数、高度、檐口、塔刹、金堂柱网、回廊柱列、门屋立面；这些不是遗漏，而是没有可核证据。
- 东院 4 号殿、8 号院墙、北门 6 号、东塔院、窑址和寺界不画；方向关系见 [site-relations.svg](../figures/site-relations.svg)，该图不按比例。

## 字段

必填 `id`、`type`、`grade`、`inference`、`source`；`grade` 表史料等级，`inference` 表几何依据。字段定义见[绘图器输入格式](../../../../scripts/ward-render/FORMAT.md)与[`ward.schema.json`](../../../../scripts/ward-render/schema/ward.schema.json)。
