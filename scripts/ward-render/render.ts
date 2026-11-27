import { globSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { PngCache, sha256, writeAtomic } from "./cache.ts";
import {
    drawPngText,
    INFERENCES,
    type Inference,
    planGrayscale,
    renderPng,
} from "./png.ts";
import {
    MAP_MARGIN,
    PNG_FOOTER_HEIGHT,
    PNG_LEGEND_WIDTH,
    PNG_MAP_GUTTER_X,
    PNG_MAP_GUTTER_Y,
    PNG_TITLE_HEIGHT,
    solvePngSize,
} from "./size.ts";

type Point = [number, number];
type Ring = Point[];

type Geometry =
    | { type: "Point"; coordinates: Point }
    | { type: "LineString"; coordinates: Point[] }
    | { type: "Polygon"; coordinates: Ring[] };

type Grade = "A" | "B" | "C" | "D";
type Properties = {
    id: string;
    layer: string;
    type: string;
    name?: string;
    label?: string;
    grade: Grade;
    inference: Inference;
    source: string;
    note?: string;
    labelPoint?: Point;
    position_precision?: string;
    period?: string;
    tianbao_visible?: string;
    parent?: string;
    size_class?: "S" | "M" | "L";
    label_priority?: 1 | 2 | 3;
    label_kind?: "object" | "quadrant" | "note" | "dimension";
    street_class?: "external" | "cross" | "lane";
    width?: number;
    width_basis?: "documented" | "analogy" | "schematic";
};

type Feature = {
    type: "Feature";
    properties: Properties;
    geometry: Geometry;
};

type FeatureCollection = {
    type: "FeatureCollection";
    features: Feature[];
};

type OutputSpec = {
    id: string;
    input: string;
    output?: string;
    title: string;
    subtitle?: string;
    size?: [number, number];
    scale?: string;
    unit?: string;
    note?: string;
    north?: boolean;
};

type Manifest = {
    ward: string;
    outputs: OutputSpec[];
};

type PatternName = "diagonal" | "cross" | "dots";

type Style = {
    fill: string;
    stroke: string;
    strokeWidth: number;
    fillOpacity?: number;
    pattern?: PatternName;
};

type Styles = {
    palette: {
        background: string;
        ink: string;
        muted: string;
        grid: string;
        frame: string;
    };
    fallback?: Style;
    types: Record<string, Style>;
    inference: Record<Inference, { dash: string | null; opacity: number }>;
};

const PNG_DASHES: Record<Inference, number[]> = {
    documented: [],
    likely: [10, 5],
    alternative: [5, 4],
    schematic: [2, 4],
    typological: [1, 6],
};

const PNG_INFERENCE_LABELS: Record<Inference, string> = {
    documented: "有直接依据",
    likely: "推定",
    alternative: "备选",
    schematic: "示意",
    typological: "类型学补足",
};

const PNG_LABEL_SIZE: Record<string, number> = {
    "label label-1": 22,
    "label label-2": 20,
    "label label-3": 18,
    quadrant: 17,
    "note-label": 16,
    "dimension-label": 16,
};

function pngLabelMetrics(label: string, className: string) {
    const size = PNG_LABEL_SIZE[className];
    // Leave room for full-width CJK glyphs and proportional ASCII.
    const emWidth = Array.from(label).reduce(
        (sum, char) => sum + (/^[\x20-\x7e]$/.test(char) ? 0.65 : 1),
        0,
    );
    return { size, width: Math.ceil(emWidth * size) + 8, height: size + 6 };
}

const PNG_OUTLINE_LAYERS = new Set([
    "ward",
    "ward-wall",
    "street",
    "zone",
    "open-ground",
    "courtyard-wall",
    "dimension",
    "label",
]);

type PngLayout = ReturnType<typeof planGrayscale> & {
    filledFeatures: ReadonlySet<Feature>;
};

function planPngLayout(features: Feature[]): PngLayout {
    const parentIds = new Set(
        features.map((feature) => feature.properties.parent),
    );
    const filledFeatures = new Set(
        features.filter(
            (feature) =>
                feature.geometry.type === "Polygon" &&
                !PNG_OUTLINE_LAYERS.has(feature.properties.layer) &&
                !parentIds.has(feature.properties.id),
        ),
    );
    const plan = planGrayscale(
        new Set(
            Array.from(
                filledFeatures,
                (feature) => feature.properties.inference,
            ),
        ),
    );
    return { ...plan, filledFeatures };
}

function gray(value: number): string {
    const hex = value.toString(16).padStart(2, "0");
    return `#${hex.repeat(3)}`;
}

const LAYER_ORDER = [
    "ward",
    "ward-wall",
    "street",
    "zone",
    "open-ground",
    "residence",
    "temple",
    "daoist-temple",
    "corridor",
    "stable",
    "service",
    "wing",
    "hall",
    "dining-hall",
    "bell-tower",
    "courtyard-wall",
    "gate",
    "findspot",
    "well",
    "vegetation",
    "dimension",
    "label",
];

const TYPE_LABELS: Record<string, string> = {
    "ward-boundary": "坊界",
    "ward-wall": "坊墙",
    street: "街巷",
    "street-external": "坊外街道",
    "street-cross": "坊内十字街",
    zone: "隅内范围（位置未详）",
    gate: "门",
    findspot: "出土地",
    temple: "佛寺",
    "daoist-temple": "道观",
    residence: "宅第",
    "open-ground": "空地/院地",
    corridor: "廊庑",
    stable: "马厩",
    service: "厨/库",
    wing: "厢房",
    well: "井",
    hall: "殿/堂",
    "dining-hall": "食堂",
    "bell-tower": "钟楼",
    "courtyard-wall": "院墙",
    vegetation: "植被",
};

const FALLBACK_STYLE: Style = {
    fill: "#e9e3d7",
    stroke: "#6c604f",
    strokeWidth: 1,
    fillOpacity: 0.6,
};

function fallbackStyle(styles: Styles): Style {
    return styles.fallback ?? FALLBACK_STYLE;
}

function patternFill(style: Style): string {
    return style.pattern ? `url(#pat-${style.pattern})` : style.fill;
}

function patternDefs(usedTypes: string[], styles: Styles): string {
    const patterns = new Set<PatternName>();
    for (const type of usedTypes) {
        const pattern = styles.types[type]?.pattern;
        if (pattern) {
            patterns.add(pattern);
        }
    }
    if (patterns.size === 0) {
        return "";
    }

    const background = styles.palette.background;
    const ink = styles.palette.ink;
    const defs: string[] = [];
    if (patterns.has("diagonal")) {
        defs.push(
            `<pattern id="pat-diagonal" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="${background}" /><line x1="0" y1="0" x2="0" y2="10" stroke="${ink}" stroke-width="1" /></pattern>`,
        );
    }
    if (patterns.has("cross")) {
        defs.push(
            `<pattern id="pat-cross" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${background}" /><path d="M0 0L10 10M10 0L0 10" stroke="${ink}" stroke-width="0.8" /></pattern>`,
        );
    }
    if (patterns.has("dots")) {
        defs.push(
            `<pattern id="pat-dots" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${background}" /><circle cx="5" cy="5" r="1.2" fill="${ink}" /></pattern>`,
        );
    }

    return `<defs>${defs.join("")}</defs>`;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is Point {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number" &&
        Number.isFinite(value[0]) &&
        Number.isFinite(value[1])
    );
}

function isRing(value: unknown): value is Ring {
    return Array.isArray(value) && value.length >= 4 && value.every(isPoint);
}

function validateGeometry(value: unknown, context: string): Geometry {
    if (!isRecord(value)) {
        throw new Error(`${context}: geometry 必须是对象`);
    }
    const type = value.type;
    const coordinates = value.coordinates;

    if (type === "Point") {
        if (!isPoint(coordinates)) {
            throw new Error(`${context}: Point 坐标无效`);
        }
        return { type, coordinates };
    }

    if (type === "LineString") {
        if (
            !Array.isArray(coordinates) ||
            coordinates.length < 2 ||
            !coordinates.every(isPoint)
        ) {
            throw new Error(`${context}: LineString 坐标无效`);
        }
        return { type, coordinates };
    }

    if (type === "Polygon") {
        if (
            !Array.isArray(coordinates) ||
            coordinates.length === 0 ||
            !coordinates.every(isRing)
        ) {
            throw new Error(`${context}: Polygon 坐标无效`);
        }
        for (const ring of coordinates) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                throw new Error(`${context}: Polygon 外环未闭合`);
            }
        }
        return { type, coordinates };
    }

    throw new Error(`${context}: 不支持的几何类型 ${String(type)}`);
}

const defaultLayers = new Map([
    ["ward-boundary", "ward"],
    ["street-external", "street"],
    ["street-cross", "street"],
    ["street-lane", "street"],
]);

function validateCollection(value: unknown, file: string): FeatureCollection {
    if (
        !isRecord(value) ||
        value.type !== "FeatureCollection" ||
        !Array.isArray(value.features)
    ) {
        throw new Error(`${file}: 不是合法的 FeatureCollection`);
    }

    const ids = new Set<string>();
    const features = value.features.map((item, index) => {
        const context = `${file}: features[${index}]`;
        if (
            !isRecord(item) ||
            item.type !== "Feature" ||
            !isRecord(item.properties)
        ) {
            throw new Error(`${context}: 不是合法的 Feature`);
        }
        const properties = item.properties;
        for (const key of ["id", "type", "grade", "inference", "source"]) {
            if (typeof properties[key] !== "string" || properties[key] === "") {
                throw new Error(`${context}: 缺少属性 ${key}`);
            }
        }
        const type = properties.type as string;
        const layer = properties.layer;
        if (
            layer !== undefined &&
            (typeof layer !== "string" || layer === "")
        ) {
            throw new Error(`${context}: layer 必须是非空字符串`);
        }
        const id = properties.id as string;
        if (ids.has(id)) {
            throw new Error(`${context}: 重复 id ${id}`);
        }
        ids.add(id);

        const grade = properties.grade as string;
        if (!["A", "B", "C", "D"].includes(grade)) {
            throw new Error(`${context}: grade 必须是 A/B/C/D`);
        }
        const inference = properties.inference as string;
        if (
            ![
                "documented",
                "likely",
                "alternative",
                "schematic",
                "typological",
            ].includes(inference)
        ) {
            throw new Error(
                `${context}: inference 必须是 documented/likely/alternative/schematic/typological`,
            );
        }
        if (
            properties.labelPoint !== undefined &&
            !isPoint(properties.labelPoint)
        ) {
            throw new Error(`${context}: labelPoint 坐标无效`);
        }

        for (const key of [
            "position_precision",
            "period",
            "tianbao_visible",
            "parent",
            "label_kind",
            "street_class",
            "width_basis",
        ]) {
            if (
                properties[key] !== undefined &&
                typeof properties[key] !== "string"
            ) {
                throw new Error(`${context}: ${key} 必须是字符串`);
            }
        }
        if (
            properties.size_class !== undefined &&
            !["S", "M", "L"].includes(String(properties.size_class))
        ) {
            throw new Error(`${context}: size_class 必须是 S/M/L`);
        }
        if (
            properties.label_priority !== undefined &&
            ![1, 2, 3].includes(Number(properties.label_priority))
        ) {
            throw new Error(`${context}: label_priority 必须是 1/2/3`);
        }
        if (
            properties.width !== undefined &&
            (typeof properties.width !== "number" || properties.width <= 0)
        ) {
            throw new Error(`${context}: width 必须是正数`);
        }

        for (const key of ["name", "label", "note"]) {
            if (
                properties[key] !== undefined &&
                typeof properties[key] !== "string"
            ) {
                throw new Error(`${context}: ${key} 必须是字符串`);
            }
        }

        return {
            type: "Feature" as const,
            properties: {
                ...(properties as Properties),
                layer: layer ?? defaultLayers.get(type) ?? type,
            },
            geometry: validateGeometry(item.geometry, context),
        };
    });

    if (features.length === 0) {
        throw new Error(`${file}: features 为空`);
    }

    return { type: "FeatureCollection", features };
}

function validateManifest(value: unknown, file: string): Manifest {
    if (
        !isRecord(value) ||
        typeof value.ward !== "string" ||
        !Array.isArray(value.outputs)
    ) {
        throw new Error(`${file}: 不是合法的 manifest`);
    }
    if (value.outputs.length === 0) {
        throw new Error(`${file}: outputs 为空`);
    }
    const outputs = value.outputs.map((item, index) => {
        const context = `${file}: outputs[${index}]`;
        if (!isRecord(item)) {
            throw new Error(`${context}: 必须是对象`);
        }
        for (const key of ["id", "input", "title"]) {
            if (typeof item[key] !== "string" || item[key] === "") {
                throw new Error(`${context}: 缺少 ${key}`);
            }
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(item.id))) {
            throw new Error(`${context}: id 必须由小写字母、数字和连字符组成`);
        }
        if (
            item.output !== undefined &&
            (typeof item.output !== "string" || !item.output)
        ) {
            throw new Error(`${context}: output 必须是非空路径`);
        }
        if (
            item.size !== undefined &&
            (!Array.isArray(item.size) ||
                item.size.length !== 2 ||
                !item.size.every(
                    (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
                ))
        ) {
            throw new Error(`${context}: size 必须是两个正数`);
        }
        if (item.north !== undefined && typeof item.north !== "boolean") {
            throw new Error(`${context}: north 必须是布尔值`);
        }
        return item as OutputSpec;
    });
    return { ward: value.ward, outputs };
}

type BBox = { minX: number; minY: number; maxX: number; maxY: number };
type Projector = (point: Point) => Point;

function geometryPoints(geometry: Geometry): Point[] {
    if (geometry.type === "Point") {
        return [geometry.coordinates];
    }
    if (geometry.type === "LineString") {
        return geometry.coordinates;
    }
    return geometry.coordinates.flat();
}

function computeBBox(features: Feature[], includeLabels = false): BBox {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const feature of features) {
        for (const [x, y] of geometryPoints(feature.geometry)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
        const anchor = includeLabels ? labelAnchor(feature) : null;
        if (anchor) {
            const [x, y] = anchor;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (!Number.isFinite(minX)) {
        throw new Error("无法计算范围：没有有效坐标");
    }

    const pad = Math.max(maxX - minX, maxY - minY) * 0.04 || 1;
    return {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad,
    };
}

function fmt(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function ringCentroid(ring: Ring): Point {
    let area = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < ring.length - 1; i += 1) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        const cross = x0 * y1 - x1 * y0;
        area += cross;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
    }

    if (Math.abs(area) < 1e-9) {
        const sum = ring.reduce<Point>(
            (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
            [0, 0],
        );
        return [sum[0] / ring.length, sum[1] / ring.length];
    }

    area *= 0.5;
    return [cx / (6 * area), cy / (6 * area)];
}

function labelAnchor(feature: Feature): Point | null {
    const props = feature.properties;
    if (!props.name && !props.label) {
        return null;
    }
    if (props.labelPoint) {
        return props.labelPoint;
    }
    if (feature.geometry.type === "Point") {
        return feature.geometry.coordinates;
    }
    if (feature.geometry.type === "LineString") {
        const points = feature.geometry.coordinates;
        return points[Math.floor(points.length / 2)];
    }
    return ringCentroid(feature.geometry.coordinates[0]);
}

function labelClass(feature: Feature): string {
    const props = feature.properties;
    switch (props.label_kind) {
        case "quadrant":
            return "quadrant";
        case "note":
            return "note-label";
        case "dimension":
            return "dimension-label";
        default:
            return `label label-${props.label_priority ?? 2}`;
    }
}

function autoPngSize(features: Feature[], plan: PngLayout) {
    const bbox = computeBBox(features, true);
    const labels = [];
    const details = [];
    for (const feature of features) {
        const anchor = labelAnchor(feature);
        const props = feature.properties;
        const text = props.label ?? props.name;
        if (anchor && text) {
            const [x, y] = anchor;
            labels.push({
                x,
                y,
                ...pngLabelMetrics(text, labelClass(feature)),
            });
        }
        if (props.layer === "street" && props.width) {
            details.push({ span: props.width, minPixels: 8 });
        }
        if (
            plan.filledFeatures.has(feature) &&
            feature.geometry.type === "Polygon"
        ) {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (const [x, y] of feature.geometry.coordinates[0]) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
            details.push({
                span: Math.min(maxX - minX, maxY - minY),
                minPixels: 16,
            });
        }
    }
    return solvePngSize(
        [bbox.maxX - bbox.minX, bbox.maxY - bbox.minY],
        labels,
        details,
    );
}

function polygonPath(rings: Ring[], project: Projector): string {
    return rings
        .map((ring) => {
            const commands = ring.map((point, index) => {
                const [x, y] = project(point);
                return `${index === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`;
            });
            return `${commands.join(" ")} Z`;
        })
        .join(" ");
}

function linePath(points: Point[], project: Projector): string {
    return points
        .map((point, index) => {
            const [x, y] = project(point);
            return `${index === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`;
        })
        .join(" ");
}

function renderFeature(
    feature: Feature,
    styles: Styles,
    project: Projector,
): string {
    if (feature.properties.layer === "label") {
        return "";
    }
    const style =
        styles.types[feature.properties.type] ?? fallbackStyle(styles);
    const inference = styles.inference[feature.properties.inference];
    const dash = inference.dash ? ` stroke-dasharray="${inference.dash}"` : "";
    const opacity = style.fillOpacity ?? 0.7;
    const geometry = feature.geometry;
    const fill = patternFill(style);

    if (geometry.type === "Polygon") {
        return `<path d="${polygonPath(geometry.coordinates, project)}" fill="${fill}" fill-opacity="${fmt(opacity * inference.opacity)}" stroke="${style.stroke}" stroke-width="${fmt(style.strokeWidth)}" stroke-linejoin="round"${dash} />`;
    }

    if (geometry.type === "LineString") {
        return `<path d="${linePath(geometry.coordinates, project)}" fill="none" stroke="${style.stroke}" stroke-width="${fmt(style.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dash} />`;
    }

    const [cx, cy] = project(geometry.coordinates);
    const radius = feature.properties.type === "gate" ? 5 : 4;
    return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${radius}" fill="${fill}" stroke="${style.stroke}" stroke-width="${fmt(style.strokeWidth)}"${dash} />`;
}

function niceLength(raw: number): number {
    const power = 10 ** Math.floor(Math.log10(raw));
    const normalized = raw / power;
    const step =
        normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * power;
}

function snapNice(value: number): number {
    const power = 10 ** Math.floor(Math.log10(value));
    const normalized = value / power;
    const step =
        normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
    return step * power;
}

function wrapLegendTypes(features: Feature[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const feature of features) {
        const type = feature.properties.type;
        if (type === "label" || type === "dimension" || seen.has(type)) {
            continue;
        }
        seen.add(type);
        result.push(type);
    }
    return result;
}

function mapFrame(
    [width, height]: [number, number],
    features: Feature[],
    png: boolean,
) {
    const margin = MAP_MARGIN;
    const titleHeight = png ? PNG_TITLE_HEIGHT : 92;
    const footerHeight = png ? PNG_FOOTER_HEIGHT : 64;
    const legendWidth = png ? PNG_LEGEND_WIDTH : 236;
    const legendX = width - margin - legendWidth;
    const mapX = margin;
    const mapY = titleHeight;
    const mapWidth = width - margin * 2 - legendWidth;
    const mapHeight = height - titleHeight - footerHeight - margin;

    const bbox = computeBBox(features, png);
    const bboxWidth = bbox.maxX - bbox.minX;
    const bboxHeight = bbox.maxY - bbox.minY;
    const gutterX = png ? PNG_MAP_GUTTER_X : 0;
    const gutterY = png ? PNG_MAP_GUTTER_Y : 0;
    const scale = Math.min(
        (mapWidth - 2 * gutterX) / bboxWidth,
        (mapHeight - 2 * gutterY) / bboxHeight,
    );
    const contentWidth = bboxWidth * scale;
    const contentHeight = bboxHeight * scale;
    const offsetX = mapX + (mapWidth - contentWidth) / 2;
    const offsetY = mapY + (mapHeight - contentHeight) / 2;
    const project: Projector = ([x, y]) => [
        offsetX + (x - bbox.minX) * scale,
        offsetY + contentHeight - (y - bbox.minY) * scale,
    ];

    return {
        margin,
        titleHeight,
        legendWidth,
        legendX,
        mapX,
        mapY,
        mapWidth,
        mapHeight,
        bbox,
        bboxWidth,
        bboxHeight,
        scale,
        project,
    };
}

function sortFeatures(features: Feature[]): Feature[] {
    const layerIndex = new Map(
        LAYER_ORDER.map((layer, index) => [layer, index]),
    );
    return [...features].sort((a, b) => {
        const left = layerIndex.get(a.properties.layer) ?? 99;
        const right = layerIndex.get(b.properties.layer) ?? 99;
        return left - right;
    });
}

function scaleBarLength(bboxWidth: number, scale: number): number {
    let length = niceLength(bboxWidth / 5);
    for (let i = 0; i < 12; i += 1) {
        const px = length * scale;
        if (px > 170) {
            length /= 2;
        } else if (px < 60) {
            length *= 2;
        } else {
            break;
        }
    }
    length = snapNice(length);
    if (length * scale > 170) {
        length = snapNice(length / 2);
    }
    if (length * scale < 60) {
        length = snapNice(length * 2);
    }
    return length;
}

function sourceCaption(spec: OutputSpec, inputLabel: string): string {
    const scaleText = spec.scale
        ? `比例 ${spec.scale}（按图面尺寸标定）`
        : spec.unit
          ? `按${spec.unit}制比例；建筑体块仍为示意`
          : "示意单位，不按固定比例";
    return `数据：${inputLabel} · ${scaleText}`;
}

const DEFAULT_NOTE = "示意底图，不是测绘平面；虚线表示推测或示意。";

function drawPngFeature(
    ctx: SKRSContext2D,
    feature: Feature,
    project: Projector,
    plan: PngLayout,
): void {
    const { geometry, properties: props } = feature;
    if (props.layer === "label") {
        return;
    }

    ctx.beginPath();
    ctx.lineCap = geometry.type === "LineString" ? "round" : "butt";
    ctx.lineJoin = "round";
    if (geometry.type === "Point") {
        const [x, y] = project(geometry.coordinates);
        ctx.arc(x, y, props.type === "gate" ? 5 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
    } else {
        const rings =
            geometry.type === "Polygon"
                ? geometry.coordinates
                : [geometry.coordinates];
        for (const ring of rings) {
            const [first, ...rest] = ring;
            ctx.moveTo(...project(first));
            for (const point of rest) {
                ctx.lineTo(...project(point));
            }
            if (geometry.type === "Polygon") {
                ctx.closePath();
            }
        }
        if (geometry.type === "Polygon") {
            const tone = plan.fills.get(props.inference);
            if (plan.filledFeatures.has(feature) && tone !== undefined) {
                ctx.fillStyle = gray(tone);
                ctx.fill("evenodd");
            } else if (props.layer === "street") {
                ctx.fillStyle = "#ffffff";
                ctx.fill("evenodd");
            }
        }
    }
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.6;
    ctx.setLineDash(PNG_DASHES[props.inference]);
    ctx.stroke();
}

function drawPngMap(
    ctx: SKRSContext2D,
    [width, height]: [number, number],
    spec: OutputSpec,
    features: Feature[],
    inputLabel: string,
    plan: PngLayout,
): void {
    const {
        margin,
        titleHeight,
        legendWidth,
        legendX,
        mapX,
        mapY,
        mapWidth,
        mapHeight,
        bboxWidth,
        scale,
        project,
    } = mapFrame([width, height], features, true);
    const sorted = sortFeatures(features);
    const labelsOnly = sorted.every(
        (feature) => feature.properties.layer === "label",
    );
    const small = (text: string, x: number, y: number) =>
        drawPngText(ctx, text, x, y, 14, "left", 0.4);

    drawPngText(ctx, spec.title, margin, 49, 34);
    if (spec.subtitle) {
        drawPngText(ctx, spec.subtitle, margin, 78, 17);
    }
    if (!labelsOnly) {
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);
    }
    for (const feature of sorted) {
        drawPngFeature(ctx, feature, project, plan);
    }
    for (const feature of sorted) {
        const anchor = labelAnchor(feature);
        const label = feature.properties.label ?? feature.properties.name;
        if (!anchor || !label) {
            continue;
        }
        const [x, y] = project(anchor);
        const { size, width, height } = pngLabelMetrics(
            label,
            labelClass(feature),
        );
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - width / 2, y - size, width, height);
        drawPngText(ctx, label, x, y, size, "center");
    }

    const statuses = INFERENCES.filter((inference) =>
        sorted.some(
            (feature) =>
                feature.properties.inference === inference &&
                !["label", "dimension"].includes(feature.properties.layer),
        ),
    );
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
        legendX,
        titleHeight,
        legendWidth - 8,
        100 + statuses.length * 28,
    );
    ctx.lineWidth = 1;
    ctx.strokeRect(
        legendX,
        titleHeight,
        legendWidth - 8,
        100 + statuses.length * 28,
    );
    drawPngText(ctx, "图例 · 平面复原依据", legendX + 16, titleHeight + 28, 18);
    for (const [index, inference] of statuses.entries()) {
        const y = titleHeight + 54 + index * 28;
        const tone = plan.fills.get(inference);
        if (tone !== undefined) {
            ctx.fillStyle = gray(tone);
            ctx.fillRect(legendX + 16, y - 11, 34, 14);
        }
        ctx.beginPath();
        ctx.moveTo(legendX + 16, y - 4);
        ctx.lineTo(legendX + 50, y - 4);
        ctx.lineWidth = 2;
        ctx.lineCap = "butt";
        ctx.setLineDash(PNG_DASHES[inference]);
        ctx.stroke();
        drawPngText(ctx, PNG_INFERENCE_LABELS[inference], legendX + 60, y, 17);
    }
    const legendY = titleHeight + 62 + statuses.length * 28;
    small(
        labelsOnly ? "仅示文字所述关系" : "线型与填灰不代表史料等级",
        legendX + 16,
        legendY,
    );
    small(
        labelsOnly ? "留白不表示空地" : "留白：道路、空地或仅画轮廓",
        legendX + 16,
        legendY + 16,
    );

    if (spec.unit) {
        const length = scaleBarLength(bboxWidth, scale);
        const barWidth = length * scale;
        const barX = width - margin - Math.max(barWidth, 120) - 16;
        const barY = height - 72;
        const segment = barWidth / 4;
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i += 1) {
            ctx.fillStyle = i % 2 === 0 ? "#000000" : "#ffffff";
            ctx.fillRect(barX + segment * i, barY, segment, 6);
            ctx.strokeRect(barX + segment * i, barY, segment, 6);
        }
        small(`${fmt(length)} ${spec.unit}`, barX, barY - 8);
    }

    if (spec.north !== false) {
        const x = mapX + mapWidth - 34;
        const y = mapY + 34;
        ctx.beginPath();
        ctx.moveTo(x, y - 18);
        ctx.lineTo(x - 8, y + 6);
        ctx.lineTo(x + 8, y + 6);
        ctx.closePath();
        ctx.fillStyle = "#000000";
        ctx.fill();
        drawPngText(ctx, "N", x, y + 24, 14, "center", 0.4);
    }
    small(spec.note ?? DEFAULT_NOTE, margin, height - 34);
    small(sourceCaption(spec, inputLabel), margin, height - 16);
}

function renderSvg(
    spec: OutputSpec,
    features: Feature[],
    styles: Styles,
    inputLabel: string,
): string {
    const [width, height] = spec.size ?? [1200, 900];
    const {
        margin,
        titleHeight,
        legendWidth,
        legendX,
        mapX,
        mapY,
        mapWidth,
        mapHeight,
        bbox,
        bboxWidth,
        bboxHeight,
        scale,
        project,
    } = mapFrame([width, height], features, false);
    const sorted = sortFeatures(features);
    const usedTypes = wrapLegendTypes(sorted);
    const labelsOnly = sorted.every(
        (feature) => feature.properties.layer === "label",
    );
    const defs = patternDefs(usedTypes, styles);

    const parts: string[] = [];
    parts.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    );
    parts.push(
        `<!-- generated by scripts/ward-render from ${escapeXml(inputLabel)}; do not edit by hand -->`,
    );
    parts.push(`<title id="title">${escapeXml(spec.title)}</title>`);
    parts.push(
        `<desc id="desc">${escapeXml(spec.subtitle ?? "里坊平面示意")}</desc>`,
    );
    if (defs) {
        parts.push(defs);
    }
    const palette = styles.palette;
    parts.push(`<style>
        text { font-family: "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", serif; }
        .title { font-size: 30px; font-weight: 700; fill: ${palette.ink}; }
        .subtitle { font-size: 15px; fill: ${palette.muted}; }
        .label { font-weight: 700; fill: ${palette.ink}; paint-order: stroke; stroke: ${palette.background}; stroke-width: 3px; stroke-linejoin: round; }
        .label-1 { font-size: 16px; }
        .label-2 { font-size: 14px; }
        .label-3 { font-size: 12px; }
        .quadrant { font-size: 13px; fill: ${palette.muted}; letter-spacing: 2px; }
        .note-label { font-size: 12px; fill: ${palette.muted}; paint-order: stroke; stroke: ${palette.background}; stroke-width: 2.5px; }
        .dimension-label { font-size: 13px; fill: ${palette.muted}; paint-order: stroke; stroke: ${palette.background}; stroke-width: 2.5px; }
        .legend-title { font-size: 15px; font-weight: 700; fill: ${palette.ink}; }
        .legend { font-size: 13px; fill: ${palette.ink}; }
        .small { font-size: 12px; fill: ${palette.muted}; }
        .tiny { font-size: 11px; fill: ${palette.muted}; }
    </style>`);
    parts.push(
        `<rect x="0" y="0" width="${width}" height="${height}" fill="${styles.palette.background}" />`,
    );
    parts.push(
        `<text class="title" x="${margin}" y="44">${escapeXml(spec.title)}</text>`,
    );
    if (spec.subtitle) {
        parts.push(
            `<text class="subtitle" x="${margin}" y="70">${escapeXml(spec.subtitle)}</text>`,
        );
    }
    parts.push(
        `<line x1="${margin}" y1="${titleHeight - 10}" x2="${width - margin}" y2="${titleHeight - 10}" stroke="${styles.palette.grid}" stroke-width="1" />`,
    );
    parts.push(
        `<rect x="${mapX}" y="${mapY}" width="${mapWidth}" height="${mapHeight}" fill="${styles.palette.background}" stroke="${labelsOnly ? "none" : styles.palette.frame}" stroke-width="1.5" />`,
    );

    const gridStep = niceLength(Math.max(bboxWidth, bboxHeight) / 8);
    const gridStartX = Math.ceil(bbox.minX / gridStep) * gridStep;
    const gridStartY = Math.ceil(bbox.minY / gridStep) * gridStep;
    for (let x = gridStartX; x <= bbox.maxX; x += gridStep) {
        const [sx] = project([x, bbox.minY]);
        parts.push(
            `<line x1="${fmt(sx)}" y1="${fmt(mapY)}" x2="${fmt(sx)}" y2="${fmt(mapY + mapHeight)}" stroke="${styles.palette.grid}" stroke-width="0.6" />`,
        );
    }
    for (let y = gridStartY; y <= bbox.maxY; y += gridStep) {
        const [, sy] = project([bbox.minX, y]);
        parts.push(
            `<line x1="${fmt(mapX)}" y1="${fmt(sy)}" x2="${fmt(mapX + mapWidth)}" y2="${fmt(sy)}" stroke="${styles.palette.grid}" stroke-width="0.6" />`,
        );
    }

    for (const feature of sorted) {
        parts.push(renderFeature(feature, styles, project));
    }

    for (const feature of sorted) {
        const anchor = labelAnchor(feature);
        if (!anchor) {
            continue;
        }
        const [x, y] = project(anchor);
        const label = feature.properties.label ?? feature.properties.name ?? "";
        const className = labelClass(feature);
        parts.push(
            `<text class="${className}" x="${fmt(x)}" y="${fmt(y)}" text-anchor="middle">${escapeXml(label)}</text>`,
        );
    }

    {
        const typological = styles.inference.typological;
        const hasTypological = sorted.some(
            (feature) => feature.properties.inference === "typological",
        );
        const legendHeight = Math.min(
            mapHeight,
            (hasTypological ? 224 : 200) + usedTypes.length * 24,
        );
        parts.push(
            `<rect x="${legendX}" y="${titleHeight}" width="${legendWidth - 8}" height="${legendHeight}" fill="${styles.palette.background}" stroke="${styles.palette.grid}" stroke-width="1" />`,
        );
        parts.push(
            `<text class="legend-title" x="${legendX + 16}" y="${titleHeight + 28}">图例</text>`,
        );
        let legendY = titleHeight + 58;
        for (const type of usedTypes) {
            const style = styles.types[type] ?? fallbackStyle(styles);
            if (style.fill === "none") {
                parts.push(
                    `<line x1="${legendX + 16}" y1="${legendY - 6}" x2="${legendX + 38}" y2="${legendY - 6}" stroke="${style.stroke}" stroke-width="${fmt(Math.max(style.strokeWidth, 1.5))}" />`,
                );
            } else {
                parts.push(
                    `<rect x="${legendX + 16}" y="${legendY - 12}" width="22" height="12" fill="${patternFill(style)}" stroke="${style.stroke}" stroke-width="${fmt(style.strokeWidth)}" />`,
                );
            }
            parts.push(
                `<text class="legend" x="${legendX + 48}" y="${legendY}">${escapeXml(TYPE_LABELS[type] ?? type)}</text>`,
            );
            legendY += 24;
        }

        legendY += 8;
        parts.push(
            `<line x1="${legendX + 16}" y1="${legendY - 8}" x2="${width - margin - 16}" y2="${legendY - 8}" stroke="${styles.palette.grid}" stroke-width="1" />`,
        );
        parts.push(
            `<line x1="${legendX + 16}" y1="${legendY + 4}" x2="${legendX + 38}" y2="${legendY + 4}" stroke="${styles.palette.ink}" stroke-width="2" />`,
        );
        parts.push(
            `<text class="legend" x="${legendX + 48}" y="${legendY + 8}">实线：文献所记</text>`,
        );
        legendY += 24;
        parts.push(
            `<line x1="${legendX + 16}" y1="${legendY + 4}" x2="${legendX + 38}" y2="${legendY + 4}" stroke="${styles.palette.ink}" stroke-width="2" stroke-dasharray="4 3" />`,
        );
        parts.push(
            `<text class="legend" x="${legendX + 48}" y="${legendY + 8}">虚线：示意、未定位或推测</text>`,
        );
        legendY += 24;
        if (hasTypological) {
            parts.push(
                `<line x1="${legendX + 16}" y1="${legendY + 4}" x2="${legendX + 38}" y2="${legendY + 4}" stroke="${styles.palette.ink}" stroke-width="2" stroke-dasharray="${typological.dash ?? "1 4"}" stroke-opacity="${fmt(typological.opacity)}" />`,
            );
            parts.push(
                `<text class="legend" x="${legendX + 48}" y="${legendY + 8}">点线：类型学补足</text>`,
            );
            legendY += 24;
        }
        legendY += 28;
        parts.push(
            `<text class="tiny" x="${legendX + 16}" y="${legendY}">证据等级</text>`,
        );
        parts.push(
            `<text class="tiny" x="${legendX + 16}" y="${legendY + 16}">A 直接记载 · B 居第可证</text>`,
        );
        parts.push(
            `<text class="tiny" x="${legendX + 16}" y="${legendY + 32}">C 仅提及 · D 不可用</text>`,
        );
    }

    if (spec.unit) {
        const barLength = scaleBarLength(bboxWidth, scale);
        const barWidth = barLength * scale;
        const barX = width - margin - Math.max(barWidth, 120) - 16;
        const barY = height - 42;
        const segment = barWidth / 4;
        for (let i = 0; i < 4; i += 1) {
            parts.push(
                `<rect x="${fmt(barX + segment * i)}" y="${fmt(barY)}" width="${fmt(segment)}" height="6" fill="${i % 2 === 0 ? styles.palette.ink : styles.palette.background}" stroke="${styles.palette.ink}" stroke-width="1" />`,
            );
        }
        parts.push(
            `<text class="small" x="${fmt(barX)}" y="${fmt(barY - 8)}">${fmt(barLength)} ${escapeXml(spec.unit)}</text>`,
        );
    }

    if (spec.north !== false) {
        const northX = mapX + mapWidth - 34;
        const northY = mapY + 34;
        parts.push(
            `<polygon points="${fmt(northX)},${fmt(northY - 18)} ${fmt(northX - 8)},${fmt(northY + 6)} ${fmt(northX + 8)},${fmt(northY + 6)}" fill="${styles.palette.ink}" />`,
        );
        parts.push(
            `<text class="small" x="${fmt(northX)}" y="${fmt(northY + 24)}" text-anchor="middle">N</text>`,
        );
    }

    parts.push(
        `<text class="small" x="${margin}" y="${height - 34}">${escapeXml(spec.note ?? DEFAULT_NOTE)}</text>`,
        `<text class="small" x="${margin}" y="${height - 16}">${escapeXml(sourceCaption(spec, inputLabel))}</text>`,
    );

    parts.push("</svg>");
    return parts.join("\n");
}

function main(): void {
    const args = process.argv.slice(2);
    let manifestPath: string | undefined;
    let all = false;
    let check = false;
    let onlyId: string | undefined;
    let theme = "base";
    let pngDir: string | undefined;

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === "--manifest") {
            manifestPath = args[i + 1];
            i += 1;
        } else if (arg === "--all") {
            all = true;
        } else if (arg === "--check") {
            check = true;
        } else if (arg === "--id") {
            onlyId = args[i + 1];
            i += 1;
        } else if (arg === "--theme") {
            theme = args[i + 1];
            i += 1;
        } else if (arg === "--png-dir") {
            const value = args[i + 1];
            if (!value || value.startsWith("--")) {
                throw new Error(`缺少 ${arg} 的路径`);
            }
            pngDir = resolve(value);
            i += 1;
        } else if (arg === "--help" || arg === "-h") {
            console.log(
                "用法：node scripts/ward-render/render.ts (--manifest <path> | --all) [--id <id>] [--theme <name> | --png-dir <path>] [--check]",
            );
            return;
        } else {
            throw new Error(`未知参数：${arg}`);
        }
    }

    if (all === Boolean(manifestPath)) {
        throw new Error("请指定 --manifest 或 --all，不能同时使用");
    }
    if (all) {
        pngDir ??= resolve(repoRoot, "build/figures/agent");
    }
    if (!/^[a-z0-9-]+$/.test(theme)) {
        throw new Error(`非法的 theme：${theme}`);
    }
    if (pngDir && theme !== "base") {
        throw new Error(
            "--png-dir 使用固定灰度样式，不能与自定义 --theme 同用",
        );
    }

    const reconstructions = resolve(repoRoot, "reconstructions");
    const manifestPaths = all
        ? globSync("**/data/manifest.json", { cwd: reconstructions })
              .sort()
              .map((path) => resolve(reconstructions, path))
        : [resolve(manifestPath ?? "")];
    const styles =
        pngDir || check
            ? undefined
            : readJson<Styles>(resolve(scriptDir, "styles", `${theme}.json`));

    const jobs = [];
    const seenOutputs = new Set<string>();
    for (const manifestAbs of manifestPaths) {
        const manifestDir = dirname(manifestAbs);
        const manifest = validateManifest(
            readJson<unknown>(manifestAbs),
            manifestAbs,
        );
        const namespace = all
            ? relative(reconstructions, dirname(manifestDir))
            : "";
        for (const spec of manifest.outputs) {
            if (onlyId && spec.id !== onlyId) {
                continue;
            }
            const output = pngDir
                ? resolve(pngDir, namespace, `${spec.id}.png`)
                : spec.output && resolve(manifestDir, spec.output);
            if (!output && !check) {
                throw new Error(
                    `${manifestAbs}: ${spec.id} 导出 SVG 需要 output 路径`,
                );
            }
            if (output) {
                if (seenOutputs.has(output)) {
                    throw new Error(`多条输出配置写入同一路径：${output}`);
                }
                seenOutputs.add(output);
            }
            jobs.push({
                spec,
                input: resolve(manifestDir, spec.input),
                output,
            });
        }
    }
    if (jobs.length === 0) {
        throw new Error(
            onlyId ? `未找到输出 ID：${onlyId}` : "未找到可绘制的输出",
        );
    }

    const fontFile = pngDir && !check ? resolvePngFont() : undefined;
    const cache = pngDir && fontFile ? new PngCache(pngDir) : undefined;
    const toolFingerprint = fontFile ? pngToolFingerprint(fontFile) : undefined;
    try {
        for (const { spec, input, output } of jobs) {
            const inputLabel = relative(
                pngDir ? repoRoot : process.cwd(),
                input,
            )
                .split("\\")
                .join("/");
            const inputBytes = readFileSync(input);
            const key =
                pngDir && output
                    ? relative(pngDir, output).split("\\").join("/")
                    : "";
            const fingerprint = toolFingerprint
                ? sha256(
                      JSON.stringify([
                          toolFingerprint,
                          sha256(inputBytes),
                          inputLabel,
                          spec.title,
                          spec.subtitle,
                          spec.note,
                          spec.scale,
                          spec.unit,
                          spec.north,
                      ]),
                  )
                : undefined;
            if (
                output &&
                fingerprint &&
                cache?.matches(key, output, fingerprint)
            ) {
                console.log(`up to date ${key}`);
                continue;
            }
            const features = validateCollection(
                JSON.parse(inputBytes.toString("utf8")),
                input,
            );
            if (check) {
                console.log(
                    `ok ${spec.id} (${features.features.length} features)`,
                );
                continue;
            }
            if (!output) {
                throw new Error(`未配置 ${spec.id} 的输出路径`);
            }
            if (fontFile) {
                const plan = planPngLayout(features.features);
                const { size, limited } = autoPngSize(features.features, plan);
                if (limited) {
                    console.warn(
                        `${spec.id}: 自动调整画布后仍有过密细节或重叠标注；建议增加分区图或调整标注锚点。`,
                    );
                }
                const png = renderPng(size, plan, fontFile, (ctx) =>
                    drawPngMap(
                        ctx,
                        size,
                        spec,
                        features.features,
                        inputLabel,
                        plan,
                    ),
                );
                writeAtomic(output, png);
                if (fingerprint) {
                    cache?.record(key, fingerprint, png);
                }
                console.log(
                    `rendered ${spec.id} (${size.join("×")}, ${plan.bitDepth}-bit) -> ${output}`,
                );
                continue;
            }
            if (!styles) {
                throw new Error("未加载 SVG 样式");
            }
            const svg = renderSvg(spec, features.features, styles, inputLabel);
            mkdirSync(dirname(output), { recursive: true });
            writeFileSync(output, svg);
            console.log(`rendered ${spec.id} -> ${output}`);
        }
    } finally {
        cache?.flush();
    }
}

function resolvePngFont(): string {
    const require = createRequire(import.meta.url);
    return resolve(
        dirname(require.resolve("@embedpdf/fonts-sc")),
        "../fonts/NotoSansHans-Regular.otf",
    );
}

function pngToolFingerprint(fontFile: string): string {
    const require = createRequire(import.meta.url);
    return sha256(
        JSON.stringify([
            ...["render.ts", "png.ts", "size.ts"].map((file) =>
                sha256(readFileSync(resolve(scriptDir, file))),
            ),
            sha256(readFileSync(fontFile)),
            require("@napi-rs/canvas/package.json").version,
            process.version,
            process.platform,
            process.arch,
        ]),
    );
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
