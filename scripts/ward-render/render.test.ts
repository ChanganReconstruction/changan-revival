import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./render.ts", import.meta.url));

test("PNG uses manifest ids, works without SVG paths, and restores only the missing image", () => {
    const dir = mkdtempSync(join(tmpdir(), "ward-render-test-"));
    const manifestPath = join(dir, "manifest.json");
    const out = join(dir, "png");
    const manifest = {
        ward: "test",
        outputs: [
            { id: "ward-plan", input: "map.geojson", title: "平康坊示意" },
            {
                id: "courtyard-plan",
                input: "map.geojson",
                title: "院落示意",
                output: "unused.svg",
            },
        ],
    };
    try {
        writeFileSync(manifestPath, JSON.stringify(manifest));
        writeFileSync(
            join(dir, "map.geojson"),
            JSON.stringify({
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            id: "gate",
                            type: "gate",
                            layer: "gate",
                            grade: "A",
                            inference: "documented",
                            source: "test",
                            name: "坊门",
                        },
                        geometry: { type: "Point", coordinates: [0, 0] },
                    },
                ],
            }),
        );
        const build = () =>
            execFileSync(
                process.execPath,
                [cli, "--manifest", manifestPath, "--png-dir", out],
                { encoding: "utf8" },
            );
        assert.match(build(), /rendered ward-plan/);
        assert.deepEqual(readdirSync(out).sort(), [
            ".render-cache.json",
            "courtyard-plan.png",
            "ward-plan.png",
        ]);
        assert.ok(!readdirSync(dir).includes("unused.svg"));
        const pngPath = join(out, "ward-plan.png");
        const png = readFileSync(pngPath);
        assert.equal(png.subarray(12, 16).toString(), "IHDR");
        assert.equal(png[24], 2);
        assert.equal(png[25], 0);
        assert.match(build(), /up to date ward-plan\.png/);
        rmSync(pngPath);
        const rebuild = build();
        assert.match(rebuild, /rendered ward-plan/);
        assert.match(rebuild, /up to date courtyard-plan\.png/);
        assert.deepEqual(readFileSync(pngPath), png);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("omitted layers match explicit defaults while label-only overrides still apply", () => {
    const dir = mkdtempSync(join(tmpdir(), "ward-render-layer-"));
    const manifest = join(dir, "manifest.json");
    const geojson = join(dir, "map.geojson");
    const out = join(dir, "png");
    const cases = [
        {
            type: "gate",
            layer: "gate",
            geometry: { type: "Point", coordinates: [50, 0] },
        },
        {
            type: "street-cross",
            layer: "street",
            width: 12,
            geometry: {
                type: "LineString",
                coordinates: [
                    [0, 50],
                    [100, 50],
                ],
            },
        },
        {
            type: "temple",
            layer: "label",
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [30, 80],
                        [70, 80],
                        [70, 100],
                        [30, 100],
                        [30, 80],
                    ],
                ],
            },
        },
    ];

    function writeMap(keepLayer: (i: number) => boolean) {
        const features = cases.map(({ type, layer, width, geometry }, i) => ({
            type: "Feature",
            properties: {
                id: type,
                type,
                ...(keepLayer(i) ? { layer } : {}),
                grade: "A",
                inference: "documented",
                source: "test",
                name: type,
                width,
            },
            geometry,
        }));
        writeFileSync(
            geojson,
            JSON.stringify({ type: "FeatureCollection", features }),
        );
    }

    function render() {
        execFileSync(process.execPath, [
            cli,
            "--manifest",
            manifest,
            "--png-dir",
            out,
        ]);
        return readFileSync(join(out, "map.png"));
    }

    try {
        writeFileSync(
            manifest,
            JSON.stringify({
                ward: "test",
                outputs: [
                    { id: "map", input: "map.geojson", title: "坊门示意" },
                ],
            }),
        );
        writeMap(() => true);
        const baseline = render();
        writeMap((i) => i === 2);
        assert.deepEqual(render(), baseline);
        writeMap(() => false);
        assert.notDeepEqual(render(), baseline);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
