import './jianfusi-demo.css';

const fadeMs = 240;

type Assets = { video: URL; courtyard: URL };

async function loadAssets(): Promise<Assets> {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  const configUrl = new URL('jianfusi.config.json', base);
  const response = await fetch(configUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const config = await response.json();
  function assetUrl(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('资源地址为空');
    const url = new URL(value, configUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('请使用 HTTP(S) 资源地址');
    }
    return url;
  }
  return { video: assetUrl(config?.videoUrl), courtyard: assetUrl(config?.courtyardUrl) };
}

export function createJianfusiDemo(dialog: HTMLDialogElement, onClose: () => void) {
  const stage = dialog.querySelector<HTMLElement>('.jianfusi-stage')!;
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!;
  const play = dialog.querySelector<HTMLButtonElement>('[data-play]')!;
  const back = dialog.querySelector<HTMLButtonElement>('[data-return]')!;
  let cleanup: (() => void) | undefined;
  let opener: HTMLElement | undefined;
  let assets: Assets | null | undefined;
  // 提前读取小配置，不提前加载大资源；通常可以在点击事件内直接播放。
  const configReady = loadAssets().then(
    (value) => { assets = value; },
    (error) => { assets = null; console.error('无法读取荐福寺资源配置', error); },
  );

  back.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    cleanup?.();
    cleanup = undefined;
    stage.replaceChildren();
    opener?.focus({ preventScroll: true });
    onClose();
  });

  async function open(trigger: HTMLElement) {
    if (assets === undefined) await configReady;
    if (dialog.open || cleanup) return;
    opener = trigger;
    if (!assets) {
      play.hidden = true;
      dialog.dataset.phase = 'error';
      status.textContent = '资源配置不可用，请检查 jianfusi.config.json 后刷新。';
      dialog.showModal();
      return;
    }
    const courtyard = new URL(assets.courtyard);
    courtyard.searchParams.set('embed', '1');
    courtyard.searchParams.set('parentOrigin', location.origin);
    const courtyardOrigin = courtyard.origin;
    const session = new AbortController();
    const { signal } = session;
    let videoFinished = false;
    let sceneReady = false;
    let failed = false;
    let revealing = false;
    let fade: number | undefined;

    const video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'auto';
    const frame = document.createElement('iframe');
    frame.title = '荐福寺庭院 · 3DGS 漫游';
    frame.inert = true;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    dialog.dataset.phase = 'video';
    play.hidden = true;
    status.textContent = '正在播放引入短片';

    function finishReveal() {
      if (failed || signal.aborted) return;
      video.remove();
      frame.inert = false;
      frame.removeAttribute('tabindex');
      frame.removeAttribute('aria-hidden');
      dialog.dataset.phase = 'courtyard';
      status.textContent = '';
      frame.contentWindow?.postMessage({ type: 'changan:jianfusi-activate' }, courtyardOrigin);
    }

    function revealWhenReady() {
      if (!videoFinished || !sceneReady || failed || revealing) return;
      revealing = true;
      play.hidden = true;
      dialog.dataset.phase = 'reveal';
      status.textContent = '';
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishReveal();
      else fade = window.setTimeout(finishReveal, fadeMs);
    }

    function failScene(message: string) {
      if (failed) return;
      failed = true;
      window.clearTimeout(timeout);
      window.clearTimeout(fade);
      frame.remove();
      dialog.dataset.phase = 'error';
      status.textContent = message;
    }

    const timeout = window.setTimeout(() => failScene('庭院加载超时，请返回长安后重试。'), 240_000);
    cleanup = () => {
      session.abort();
      window.clearTimeout(timeout);
      window.clearTimeout(fade);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    window.addEventListener('message', (event) => {
      if (event.origin !== courtyardOrigin || event.source !== frame.contentWindow
        || event.data?.type !== 'changan:jianfusi') return;
      if (event.data.state === 'error') failScene('庭院未能载入，请返回长安后重试。');
      if (event.data.state === 'ready') {
        sceneReady = true;
        window.clearTimeout(timeout);
        revealWhenReady();
      }
    }, { signal });
    video.addEventListener('ended', () => {
      videoFinished = true;
      if (!sceneReady && !failed) {
        dialog.dataset.phase = 'waiting';
        status.textContent = '正在准备庭院首帧…';
      }
      revealWhenReady();
    }, { signal });
    video.addEventListener('error', () => {
      videoFinished = true;
      play.hidden = true;
      if (!failed) {
        dialog.dataset.phase = 'waiting';
        status.textContent = '短片不可用，正在直接进入庭院…';
      }
      revealWhenReady();
    }, { signal });
    function playVideo() {
      play.hidden = true;
      void video.play().catch(() => {
        if (!signal.aborted && !videoFinished) play.hidden = false;
      });
    }
    play.addEventListener('click', playVideo, { signal });

    // Vite 对不存在的 HTML 可能返回应用首页；检查桥接脚本的标识。
    if (courtyardOrigin === location.origin) {
      frame.addEventListener('load', () => {
        if (!frame.contentDocument?.getElementById('changan-courtyard-demo')) {
          failScene('找不到带桥接的庭院页面，请检查资源地址。');
        }
      }, { signal });
    }
    video.src = assets.video.href;
    frame.src = courtyard.href;
    stage.replaceChildren(frame, video);
    dialog.showModal();
    playVideo();
  }

  return { open, get active() { return dialog.open; } };
}
