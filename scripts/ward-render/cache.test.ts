import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PngCache, writeAtomic } from "./cache.ts";

test("cache requires both a matching fingerprint and the original PNG", (t) => {
    const dir = mkdtempSync(join(tmpdir(), "ward-cache-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const key = "ward/plan.png";
    const output = join(dir, key);
    const png = Buffer.from("rendered PNG");

    const cache = new PngCache(dir);
    assert.equal(cache.matches(key, output, "first"), false);
    writeAtomic(output, png);
    cache.record(key, "first", png);
    cache.flush();

    const persisted = new PngCache(dir);
    assert.equal(persisted.matches(key, output, "first"), true);
    assert.equal(persisted.matches(key, output, "changed"), false);
    writeFileSync(output, "different PNG");
    assert.equal(persisted.matches(key, output, "first"), false);
    rmSync(output);
    assert.equal(persisted.matches(key, output, "first"), false);
});

test("separate writes retain unrelated keys and damaged indexes are disposable", (t) => {
    const dir = mkdtempSync(join(tmpdir(), "ward-cache-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const first = new PngCache(dir);
    const second = new PngCache(dir);
    const png = Buffer.from("image");
    for (const [index, cache] of [first, second].entries()) {
        const key = `${index}.png`;
        writeAtomic(join(dir, key), png);
        cache.record(key, "same", png);
        cache.flush();
    }
    const persisted = new PngCache(dir);
    assert.equal(persisted.matches("0.png", join(dir, "0.png"), "same"), true);
    assert.equal(persisted.matches("1.png", join(dir, "1.png"), "same"), true);
    writeFileSync(join(dir, ".render-cache.json"), "{truncated");
    assert.equal(
        new PngCache(dir).matches("0.png", join(dir, "0.png"), "same"),
        false,
    );
});
