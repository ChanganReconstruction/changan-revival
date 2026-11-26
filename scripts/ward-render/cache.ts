import { createHash, randomUUID } from "node:crypto";
import {
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export function sha256(value: string | Buffer): string {
    return createHash("sha256").update(value).digest("hex");
}

function readIfPresent(path: string): Buffer | undefined {
    try {
        return readFileSync(path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }
}

export function writeAtomic(path: string, value: string | Buffer): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
        writeFileSync(tmp, value);
        renameSync(tmp, path);
    } finally {
        rmSync(tmp, { force: true });
    }
}

type Entry = { fingerprint: string; pngHash: string };

export class PngCache {
    private readonly path: string;
    private readonly entries = new Map<string, Entry>();
    private readonly pending = new Map<string, Entry>();

    constructor(directory: string) {
        this.path = resolve(directory, ".render-cache.json");
        this.entries = this.read();
    }

    private read(): Map<string, Entry> {
        const content = readIfPresent(this.path);
        if (content) {
            try {
                const cache = JSON.parse(content.toString("utf8"));
                if (cache?.version === 1 && Array.isArray(cache.entries)) {
                    return new Map(cache.entries);
                }
            } catch {
                // Discard unreadable cache data, never the images.
            }
        }
        return new Map();
    }

    matches(key: string, output: string, fingerprint: string): boolean {
        const entry = this.entries.get(key);
        if (!entry || entry.fingerprint !== fingerprint) {
            return false;
        }
        const png = readIfPresent(output);
        return png !== undefined && entry.pngHash === sha256(png);
    }

    record(key: string, fingerprint: string, png: Buffer): void {
        this.pending.set(key, { fingerprint, pngHash: sha256(png) });
    }

    flush(): void {
        if (this.pending.size === 0) {
            return;
        }
        const entries = this.read();
        for (const [key, entry] of this.pending) {
            entries.set(key, entry);
        }
        writeAtomic(
            this.path,
            `${JSON.stringify({ version: 1, entries: [...entries] }, null, 2)}\n`,
        );
        this.pending.clear();
    }
}
