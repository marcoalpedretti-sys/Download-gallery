(() => {
  const ID = '__scarica_galleria__';
  const prev = document.getElementById(ID);
  if (prev) { prev.remove(); return; }

  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647';
  (document.body || document.documentElement).appendChild(host);
  const R = host.attachShadow({ mode: 'open' });

  const IMG = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?|heic)(\?|#|$)/i;
  const VID = /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i;
  const STR = /\.(m3u8|mpd)(\?|#|$)/i;
  const NOISE = /active|selected|current|show|hidden|visible|lazy|load|swiper-slide-|slick-|^is-|^has-|^ng-|focus|hover|open/i;
  const site = location.hostname.replace(/^www\./, '') || 'pagina';

  const abs = u => { try { return u ? new URL(u, location.href).href : null; } catch (e) { return null; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const best = s => {
    if (!s) return null;
    let b = null, bw = -1;
    s.split(/,\s+/).forEach(p => {
      const [u, d] = p.trim().split(/\s+/);
      if (!u) return;
      const w = d ? parseFloat(d) * (/x$/.test(d) ? 1e4 : 1) : 1;
      if (w > bw) { bw = w; b = u; }
    });
    return b;
  };
  const fname = u => {
    if (/^data:/.test(u)) return 'immagine';
    try {
      const p = decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() || 'file');
      return p.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
    } catch (e) { return 'file'; }
  };
  const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };
  const sameOrigin = u => { try { return new URL(u).origin === location.origin; } catch (e) { return false; } };

  // Firma della posizione nella pagina: immagini con la stessa catena di contenitori = stessa galleria
  const sig = el => {
    const a = [];
    let e = el.parentElement, d = 0;
    while (e && e !== document.body && e !== document.documentElement && d < 6) {
      a.push(e.tagName + '.' + [...e.classList].filter(c => !/\d/.test(c) && !NOISE.test(c)).sort().join('.'));
      e = e.parentElement; d++;
    }
    return a.join('<');
  };
  const label = el => {
    let e = el;
    for (let i = 0; i < 10 && e && e.getAttribute; i++, e = e.parentElement) {
      const l = e.getAttribute('aria-label') || '';
      if (l && l.length < 60) return l;
      const c = typeof e.className === 'string' ? e.className : '';
      const m = c.match(/[\w-]*(galler|carousel|slider|swiper|photo|foto|media|thumb)[\w-]*/i);
      if (m) return m[0];
    }
    return null;
  };
  const docOrder = (a, b) => a.el === b.el ? 0 : (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);

  const S = { large: true, min: 150, groups: [], vids: [], sel: new Set(), selV: new Set(), open: {}, busy: false, fail: [], first: true };

  function scan() {
    const imgs = new Map(), vids = new Map();
    const addI = (u, t, el, w, h) => {
      u = abs(u);
      if (!u || imgs.has(u) || !/^(https?|data):/.test(u)) return;
      if (/^data:/.test(u) && u.length < 3000) return;
      let th = abs(t);
      if (!th || /^data:/.test(th) && th.length < 3000) th = u;
      imgs.set(u, { u, t: th, el, w: w || 0, h: h || 0 });
    };
    const addV = (u, el, poster, stream, label) => {
      if (!u) return;
      const st = stream || STR.test(u) || /^blob:/.test(u);
      const k = st ? 's' + vids.size : abs(u);
      if (!k || vids.has(k)) return;
      vids.set(k, { u: st ? k : abs(u), el, p: poster ? abs(poster) : null, s: st, l: label });
    };

    document.querySelectorAll('img').forEach(i => {
      if (host.contains(i)) return;
      const D = i.dataset;
      const t = i.currentSrc || i.src || D.src || D.lazySrc;
      let u = best(i.getAttribute('srcset')) || best(D.srcset);
      if (S.large) u = D.zoomImage || D.full || D.large || D.hiRes || D.original || u;
      u = u || D.lazySrc || D.src || i.currentSrc || i.src;
      const a = i.closest('a[href]');
      const big = a && IMG.test(a.href);
      if (S.large && big) u = a.href;
      const w = i.naturalWidth || i.width, h = i.naturalHeight || i.height;
      if (!big && w && h && Math.max(w, h) < S.min) return;
      addI(u, t, i, abs(u) === abs(t) ? w : 0, abs(u) === abs(t) ? h : 0);
    });

    const all = document.body ? document.body.querySelectorAll('*') : [];
    if (all.length < 8000) all.forEach(e => {
      if (e === host) return;
      const b = getComputedStyle(e).backgroundImage;
      if (!b || b === 'none' || b.indexOf('url(') < 0) return;
      if (e.offsetWidth && Math.max(e.offsetWidth, e.offsetHeight) < S.min) return;
      [...b.matchAll(/url\(["']?(.*?)["']?\)/g)].forEach(x => addI(x[1], x[1], e, 0, 0));
    });

    document.querySelectorAll('a[href]').forEach(a => {
      if (IMG.test(a.href) && !a.querySelector('img')) addI(a.href, a.href, a, 0, 0);
      if (VID.test(a.href) || STR.test(a.href)) addV(a.href, a, null);
    });

    document.querySelectorAll('video').forEach(v => {
      const c = [v.currentSrc, v.getAttribute('src') && v.src, ...[...v.querySelectorAll('source')].map(s => s.src), v.dataset.src].filter(Boolean);
      const ok = c.find(x => !/^blob:/.test(x) && !STR.test(x));
      addV(ok || 'flusso', v, v.poster, !ok);
    });
    document.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"]')
      .forEach(m => addV(m.content, null, null));
    document.querySelectorAll('iframe[src]').forEach(f => {
      const m = f.src.match(/youtube|youtu\.be|vimeo|dailymotion|matterport|wistia|brightcove/i);
      if (m) addV(f.src, f, null, true, 'Video incorporato (' + m[0] + ')');
    });

    const g = new Map();
    imgs.forEach(it => { const k = sig(it.el); if (!g.has(k)) g.set(k, []); g.get(k).push(it); });
    const groups = [], single = [];
    g.forEach(arr => {
      arr.sort(docOrder);
      if (arr.length > 1) groups.push({ items: arr, name: label(arr[0].el) });
      else single.push(arr[0]);
    });
    groups.sort((a, b) => b.items.length - a.items.length);
    if (single.length) groups.push({ items: single.sort(docOrder), name: 'Immagini isolate', single: true });
    let i = 0;
    groups.forEach((gr, gi) => gr.items.forEach(x => { x.i = i++; x.g = gi; }));
    S.groups = groups;
    S.flat = groups.flatMap(gr => gr.items);
    S.vids = [...vids.values()];
    S.open = {};
    const present = new Set(S.flat.map(x => x.u));
    const anySel = [...S.sel].some(u => present.has(u));
    if (S.first || !anySel) {
      const top = groups.find(gr => !gr.single) || groups[0];
      if (top) top.items.forEach(x => S.sel.add(x.u));
      S.first = false;
    }
  }

  // ---------- ZIP (senza compressione: foto e video sono già compressi) ----------
  const T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = [];
    const d = new Date();
    const dt = ((((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) << 16 | (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) >>> 0;
    let off = 0, cs = 0;
    for (const f of files) {
      const n = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint32(10, dt, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true);
      h.setUint16(26, n.length, true);
      parts.push(h.buffer, n, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(12, dt, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true);
      c.setUint16(28, n.length, true); c.setUint32(42, off, true);
      cen.push(c.buffer, n);
      off += 30 + n.length + sz; cs += 46 + n.length;
    }
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, e.buffer], { type: 'application/zip' });
  }
  const save = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function download(asZip) {
    const list = [];
    const selGroups = S.groups.filter(gr => gr.items.some(x => S.sel.has(x.u)));
    const folders = selGroups.length > 1;
    S.groups.forEach((gr, gi) => {
      const sel = gr.items.filter(x => S.sel.has(x.u));
      sel.forEach((x, j) => list.push({
        u: x.u,
        name: (folders && asZip ? (gr.single ? 'altre' : 'galleria-' + (gi + 1)) + '/' : '') + String(j + 1).padStart(3, '0') + '_' + fname(x.u)
      }));
    });
    S.vids.forEach(v => { if (!v.s && S.selV.has(v.u)) list.push({ u: v.u, name: (asZip ? 'video/' : '') + fname(v.u) }); });
    if (!list.length) return;
    list.forEach((x, o) => x.o = o);

    S.busy = true; S.fail = []; upd(); prog(0, list.length);
    const out = [];
    let k = 0, done = 0;
    const one = async it => {
      try {
        const r = await fetch(it.u, { credentials: sameOrigin(it.u) ? 'include' : 'omit' });
        if (!r.ok) throw new Error(r.status);
        const b = await r.blob();
        let n = it.name;
        if (!/\.\w{2,5}$/.test(n)) {
          const ex = (b.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('quicktime', 'mov').replace(/[+;].*/, '');
          n += '.' + ex;
        }
        out.push({ ...it, name: n, blob: b });
      } catch (e) { S.fail.push(it); }
      prog(++done, list.length);
    };
    await Promise.all(Array.from({ length: 4 }, async () => { while (k < list.length) await one(list[k++]); }));
    out.sort((a, b) => a.o - b.o);

    const used = new Set();
    out.forEach(f => {
      let n = f.name, i = 1;
      while (used.has(n.toLowerCase())) { const m = f.name.match(/^(.*?)(\.[^./]*)?$/); n = m[1] + '-' + (++i) + (m[2] || ''); }
      used.add(n.toLowerCase()); f.name = n;
    });

    if (out.length) {
      if (asZip) {
        status('Creo lo ZIP…');
        const files = [];
        for (const f of out) files.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
        save(zip(files), site + '-' + new Date().toISOString().slice(0, 10) + '.zip');
      } else {
        for (const f of out) { save(f.blob, f.name.split('/').pop()); await sleep(450); }
      }
    }
    S.busy = false;
    render();
    status(out.length
      ? 'Scaricati ' + out.length + ' file' + (asZip ? ' in un unico ZIP' : '') + (S.fail.length ? ' · ' + S.fail.length + ' bloccati dal sito' : '')
      : 'Il sito ha bloccato il download. Apri i file dalla lista in alto.');
  }

  // ---------- Interfaccia ----------
  const css = `
  .w{--bg:#fbfbf9;--sf:#eff1ec;--ln:#dadfd6;--fg:#1a1e1c;--mu:#616a66;--ac:#2f49c4;--acf:#ffffff;
     font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--fg);-webkit-text-size-adjust:100%}
  @media (prefers-color-scheme:dark){.w{--bg:#161819;--sf:#222526;--ln:#33383a;--fg:#ebeeec;--mu:#9aa39f;--ac:#93a5ff;--acf:#10142b;color-scheme:dark}}
  *{box-sizing:border-box;margin:0;font:inherit;color:inherit}
  .bk{position:fixed;inset:0;background:rgba(8,10,10,.45)}
  .p{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);background:var(--bg);display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(0,0,0,.28)}
  @media (max-width:640px){.p{top:auto;left:0;width:100%;height:90vh;height:90dvh;border-radius:16px 16px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.28)}}
  header{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--ln)}
  header h1{font-size:16px;font-weight:700;letter-spacing:-.01em}
  header small{display:block;color:var(--mu);font-size:12px}
  .x{margin-left:auto;flex:none;width:36px;height:36px;border-radius:50%;border:0;background:var(--sf);cursor:pointer;font-size:20px;line-height:1}
  .tb{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--ln);font-size:13px}
  .tb label{display:flex;gap:6px;align-items:center;cursor:pointer}
  .tb input{accent-color:var(--ac);width:16px;height:16px}
  select,.tb button{border:1px solid var(--ln);background:var(--sf);border-radius:8px;padding:6px 9px;font-size:13px;cursor:pointer}
  .tb button{margin-left:auto}
  .bd{flex:1;overflow:auto;padding:14px 16px 20px;display:flex;flex-direction:column;gap:20px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
  h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);font-weight:600}
  .sec{display:flex;flex-direction:column;gap:14px}
  .g{display:flex;flex-direction:column;gap:8px}
  .gh{display:flex;align-items:center;gap:8px;min-width:0}
  .ga{display:flex;align-items:center;gap:8px;border:0;background:none;cursor:pointer;padding:4px 0;min-width:0;text-align:left}
  .ga b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .n{margin-left:auto;flex:none;color:var(--mu);font-size:12px;font-variant-numeric:tabular-nums}
  .cb{flex:none;width:18px;height:18px;border-radius:5px;border:1.5px solid var(--mu);display:grid;place-items:center}
  .cb.on{background:var(--ac);border-color:var(--ac)}
  .cb.on::after,.th.on .ck::after{content:"";width:5px;height:9px;border:solid var(--acf);border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)}
  .cb.mid{border-color:var(--ac)}
  .cb.mid::after{content:"";width:8px;height:2px;border-radius:1px;background:var(--ac)}
  .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px}
  .th{position:relative;aspect-ratio:1;border:0;padding:0;border-radius:8px;overflow:hidden;background:var(--sf);cursor:pointer;box-shadow:inset 0 0 0 0 var(--ac)}
  .th img{width:100%;height:100%;object-fit:cover;display:block;opacity:.45;transition:opacity .15s}
  .th.on img{opacity:1}
  .th.on::before{content:"";position:absolute;inset:0;border:2.5px solid var(--ac);border-radius:8px;z-index:1}
  .ck{position:absolute;top:5px;right:5px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.35);border:1.5px solid #fff;display:grid;place-items:center;z-index:2}
  .th.on .ck{background:var(--ac);border-color:var(--ac)}
  .dm{position:absolute;left:4px;bottom:4px;font-size:10px;line-height:1.3;background:rgba(0,0,0,.6);color:#fff;padding:1px 4px;border-radius:4px;font-variant-numeric:tabular-nums;z-index:2}
  .more{align-self:flex-start;border:0;background:none;color:var(--ac);font-weight:600;cursor:pointer;padding:2px 0}
  .vl{display:flex;flex-direction:column;gap:8px}
  .v{display:flex;align-items:center;gap:10px;width:100%;border:1px solid var(--ln);background:var(--bg);border-radius:10px;padding:8px;text-align:left;cursor:pointer}
  .v.on{border-color:var(--ac);background:var(--sf)}
  .v:disabled{opacity:.55;cursor:default}
  .vp{flex:none;width:64px;height:40px;border-radius:6px;background:var(--sf);display:grid;place-items:center;overflow:hidden;color:var(--mu);font-size:13px}
  .vp img{width:100%;height:100%;object-fit:cover}
  .vt{min-width:0;display:flex;flex-direction:column}
  .vt b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vt small{color:var(--mu);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .em{color:var(--mu);font-size:13px}
  .fl{background:var(--sf);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;font-size:13px}
  .fl a{color:var(--ac);word-break:break-all}
  footer{border-top:1px solid var(--ln);padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px}
  .st{font-size:13px;color:var(--mu);font-variant-numeric:tabular-nums;min-height:18px}
  .pg{height:4px;background:var(--sf);border-radius:2px;overflow:hidden}
  .pg i{display:block;height:100%;width:0;background:var(--ac);transition:width .2s}
  .bt{display:flex;gap:8px}
  .bt button{flex:1;border-radius:10px;padding:12px;font-weight:600;cursor:pointer;border:1px solid var(--ln);background:var(--sf)}
  .bt .pri{flex:2;background:var(--ac);color:var(--acf);border-color:var(--ac)}
  button:disabled{opacity:.45;cursor:default}
  button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

  R.innerHTML = `<style>${css}</style><div class="w">
    <div class="bk" data-x="1"></div>
    <section class="p" role="dialog" aria-label="Scarica Galleria">
      <header><div><h1>Scarica Galleria</h1><small>${esc(site)}</small></div><button class="x" data-x="1" aria-label="Chiudi">×</button></header>
      <div class="tb">
        <label><input type="checkbox" id="lg" checked> Versione grande</label>
        <select id="mn" aria-label="Dimensione minima">
          <option value="0">Tutte le misure</option><option value="150" selected>Almeno 150 px</option>
          <option value="400">Almeno 400 px</option><option value="800">Almeno 800 px</option>
        </select>
        <button id="rs">Riscansiona</button>
      </div>
      <div class="bd"></div>
      <footer><div class="st"></div><div class="pg" hidden><i></i></div>
        <div class="bt"><button id="one">Uno a uno</button><button id="zip" class="pri">Scarica ZIP</button></div></footer>
    </section></div>`;
  const $ = s => R.querySelector(s);

  function gh(gr, gi) {
    const n = gr.items.length, s = gr.items.filter(x => S.sel.has(x.u)).length;
    const open = S.open[gi] || n <= 12;
    const shown = open ? gr.items : gr.items.slice(0, 12);
    return `<div class="g">
      <div class="gh"><button class="ga" data-g="${gi}" aria-pressed="${s === n}"><span class="cb ${s === n ? 'on' : s ? 'mid' : ''}"></span><b>${esc(gr.name ? gr.name.charAt(0).toUpperCase() + gr.name.slice(1) : 'Galleria ' + (gi + 1))}</b></button><span class="n">${s} di ${n}</span></div>
      <div class="gr">${shown.map(x => `<button class="th ${S.sel.has(x.u) ? 'on' : ''}" data-i="${x.i}" aria-pressed="${S.sel.has(x.u)}" title="${esc(fname(x.u))}"><img loading="lazy" src="${esc(x.t)}" alt=""><span class="ck"></span>${x.w && x.h ? `<span class="dm">${x.w}×${x.h}</span>` : ''}</button>`).join('')}</div>
      ${!open ? `<button class="more" data-o="${gi}">Mostra tutte (${n})</button>` : ''}
    </div>`;
  }
  function vh() {
    if (!S.vids.length) return '<p class="em">Nessun video trovato in questa pagina.</p>';
    return '<div class="vl">' + S.vids.map((v, vi) => {
      const on = S.selV.has(v.u);
      return `<button class="v ${on ? 'on' : ''}" data-v="${vi}" ${v.s ? 'disabled' : ''} aria-pressed="${on}">
        <span class="cb ${on ? 'on' : ''}"></span>
        <span class="vp">${v.p ? `<img src="${esc(v.p)}" alt="">` : '▶'}</span>
        <span class="vt"><b>${esc(v.s ? (v.l || 'Video in streaming') : fname(v.u))}</b><small>${esc(v.s ? 'Non scaricabile come file' : hostOf(v.u))}</small></span>
      </button>`;
    }).join('') + '</div>';
  }
  function render() {
    const real = S.groups.filter(g => !g.single).length;
    let h = '';
    if (S.fail.length) h += `<div class="fl"><b>${S.fail.length} file bloccati dal sito</b><span>Aprili uno alla volta e salvali con pressione lunga o tasto destro.</span>${S.fail.map(f => `<a href="${esc(f.u)}" target="_blank" rel="noopener">${esc(fname(f.u))}</a>`).join('')}</div>`;
    h += `<div class="sec"><h2>Foto · ${real} ${real === 1 ? 'galleria' : 'gallerie'}</h2>${S.groups.length ? S.groups.map(gh).join('') : '<p class="em">Nessuna immagine trovata. Se la galleria carica le foto mentre scorri, scorri fino in fondo e tocca Riscansiona.</p>'}</div>`;
    h += `<div class="sec"><h2>Video · ${S.vids.length}</h2>${vh()}</div>`;
    const bd = $('.bd'), top = bd.scrollTop;
    bd.innerHTML = h; bd.scrollTop = top;
    upd();
  }
  function count() {
    const ni = S.flat.filter(x => S.sel.has(x.u)).length;
    const nv = S.vids.filter(v => !v.s && S.selV.has(v.u)).length;
    return [ni, nv];
  }
  function status(t) { $('.st').textContent = t; }
  function prog(d, t) { const p = $('.pg'); p.hidden = !t || d >= t && !S.busy; $('.pg i').style.width = (t ? d / t * 100 : 0) + '%'; if (S.busy) status('Scarico ' + d + ' di ' + t + '…'); }
  function upd() {
    const [ni, nv] = count();
    $('#zip').disabled = $('#one').disabled = S.busy || !(ni + nv);
    $('#zip').textContent = ni + nv ? 'Scarica ZIP (' + (ni + nv) + ')' : 'Scarica ZIP';
    if (!S.busy) { $('.pg').hidden = true; status(ni + nv ? ni + ' foto' + (nv ? ' · ' + nv + ' video' : '') + ' selezionat' + (nv ? 'i' : 'e') : 'Tocca le foto o una galleria per selezionarle'); }
  }

  const close = () => { host.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey, true);

  R.addEventListener('click', e => {
    const t = e.target.closest('[data-x],[data-i],[data-g],[data-o],[data-v],#rs,#zip,#one');
    if (!t || S.busy && !t.dataset.x) return;
    if (t.dataset.x) return close();
    if (t.dataset.i) { const u = S.flat[+t.dataset.i].u; S.sel.has(u) ? S.sel.delete(u) : S.sel.add(u); return render(); }
    if (t.dataset.g) { const it = S.groups[+t.dataset.g].items; const all = it.every(x => S.sel.has(x.u)); it.forEach(x => all ? S.sel.delete(x.u) : S.sel.add(x.u)); return render(); }
    if (t.dataset.o) { S.open[+t.dataset.o] = 1; return render(); }
    if (t.dataset.v) { const u = S.vids[+t.dataset.v].u; S.selV.has(u) ? S.selV.delete(u) : S.selV.add(u); return render(); }
    if (t.id === 'rs') { S.fail = []; scan(); return render(); }
    if (t.id === 'zip') return download(true);
    if (t.id === 'one') return download(false);
  });
  R.addEventListener('change', e => {
    if (e.target.id === 'lg') S.large = e.target.checked;
    if (e.target.id === 'mn') S.min = +e.target.value;
    scan(); render();
  });

  scan(); render();
})();
