import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, open, rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const original = new URL(
    "../../古塔庭院_完整高斯高清漫游.html",
    import.meta.url,
);
const video = new URL("../../jianfusi.mp4", import.meta.url);
const output = new URL("../public/jianfusi-demo/", import.meta.url);
const temporary = new URL(`courtyard-${process.pid}.html.tmp`, output);
const courtyard = new URL("courtyard.html", output);
const launch = "requestAnimationFrame(frame);loadScene();";
const draw = "  viewer?.update();viewer?.render();";
const onReady = "$('gate').hidden=true;startWalking();";
const endScript = "</script>";

// 只替换末尾应用脚本；前面的内嵌模型按字节流复制，原文件不变。
const handle = await open(original);
let offset;
let tail;
try {
    const { size } = await handle.stat();
    offset = Math.max(0, size - 64 * 1024);
    const buffer = Buffer.alloc(size - offset);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
    if (bytesRead !== buffer.length)
        throw new Error("未能读取完整的庭院应用脚本。");
    // 从 ASCII 标记对齐，避免在 UTF-8 字符中间切开。
    const start = buffer.lastIndexOf("const T = globalThis.THREE");
    if (start < 0) throw new Error("未找到预期的庭院应用脚本，未生成样板。");
    offset += start;
    tail = buffer.subarray(start).toString("utf8");
} finally {
    await handle.close();
}
for (const anchor of [launch, draw, onReady, endScript]) {
    if (tail.split(anchor).length !== 2)
        throw new Error(`庭院版本不匹配：${anchor}`);
}

tail = tail
    .replace(
        onReady,
        "$('gate').hidden=true;if(embedded)paused();else startWalking();",
    )
    .replace(
        draw,
        `${draw}
  if(embedded && !firstFrame) {
   firstFrame=true;
   requestAnimationFrame(()=>sendToCity('ready'));
  }`,
    )
    .replace(
        launch,
        `
const embedParams = new URLSearchParams(location.search);
const parentOrigin = embedParams.get('parentOrigin') || location.origin;
const embedded = parent !== window && embedParams.get('embed') === '1';
let firstFrame = false;
const sendToCity = (state) => parent.postMessage({type:'changan:jianfusi',state},parentOrigin);
if(embedded){
 addEventListener('message',event=>{
  if(event.source===parent && event.origin===parentOrigin &&
     event.data?.type==='changan:jianfusi-activate')startWalking();
 });
 addEventListener('webglcontextlost',()=>sendToCity('error'),true);
 addEventListener('error',()=>sendToCity('error'));
 addEventListener('unhandledrejection',()=>sendToCity('error'));
}
requestAnimationFrame(frame);
loadScene().then(()=>{if(embedded && !ready)sendToCity('error')});
`,
    )
    .replace(
        endScript,
        `${endScript}<template id="changan-courtyard-demo"></template>`,
    );

await mkdir(output, { recursive: true });
try {
    async function* scene() {
        yield* createReadStream(original, { end: offset - 1 });
        yield tail;
    }
    await pipeline(scene(), createWriteStream(temporary, { flags: "wx" }));
    await copyFile(video, new URL("jianfusi.mp4", output));
    await rename(temporary, courtyard);
} finally {
    await rm(temporary, { force: true });
}
console.log(`荐福寺样板资产已准备：${fileURLToPath(output)}`);
