/* The 4 animated figures. Every frame is a pure function of progress p (0 to 1).
   Grid cards rest on their last frame (the result). They replay on hover (desktop) or once when in view (touch).
   Project pages play once when in view. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const BASE = document.currentScript ? new URL(".", document.currentScript.src) : new URL("assets/", location.href);
const DATA = window.SITE_DATA;

/* ---------- helpers ---------- */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const ORANGE = hex("#F28C00"), ORANGE_INK = hex("#B86A00"), BLUE = hex("#1F7AE0"), RED = hex("#E5383B"), RED_INK = hex("#C62828"), INK = hex("#1D1D1F");
const SANS = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function interpAt(ts, vs, x) {
  if (x <= ts[0]) return vs[0];
  for (let i = 1; i < ts.length; i++) if (x <= ts[i]) { const t = (x - ts[i - 1]) / (ts[i] - ts[i - 1] || 1); return lerp(vs[i - 1], vs[i], t); }
  return vs[vs.length - 1];
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function chip(ctx, W, x, y, text, col, alpha) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `600 12px ${SANS}`;
  const w = ctx.measureText(text).width + 20, h = 24;
  const x0 = Math.max(8, Math.min(x - w / 2, W - w - 8));
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  roundRect(ctx, x0, y - h / 2, w, h, 12); ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = rgb(col); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x0 + 10, y + 0.5);
  ctx.restore();
}
function cloudChip(ctx, W, x, y, text, alpha) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `600 12px ${SANS}`;
  const w = ctx.measureText(text).width + 44, h = 24;
  const x0 = Math.max(8, Math.min(x - w / 2, W - w - 8));
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  roundRect(ctx, x0, y - h / 2, w, h, 12); ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.fill();
  ctx.shadowColor = "transparent";
  const ix = x0 + 11, iy = y + 2; ctx.fillStyle = "#7C8798";
  for (const [dx, dy, r] of [[5, 1, 4], [10, -2, 5.2], [15, 1, 4]]) { ctx.beginPath(); ctx.arc(ix + dx, iy + dy, r, 0, 7); ctx.fill(); }
  ctx.fillRect(ix + 5, iy + 1, 10, 4);
  ctx.fillStyle = "#4A5261"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x0 + 34, y + 0.5);
  ctx.restore();
}
function polyLen(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; }
function partialPath(ctx, pts, L, frac) {
  const stop = L[L.length - 1] * frac; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (L[i] <= stop) ctx.lineTo(pts[i][0], pts[i][1]);
    else { const t = (stop - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)); break; }
  }
}
const setRead = (w, html) => { if (w.read._h !== html) { w.read.innerHTML = html; w.read._h = html; } };

/* ---------- 01 cloud gaps (LAI) ---------- */
function drawLAI(w, ctx, W, H, p) {
  const D = DATA.lai, S = w.state;
  const narrow = W < 540, tile = narrow ? 0 : 96;
  const L = narrow ? 30 : tile + 60, R = W - 20, T = narrow ? 92 : 66, B = H - 108, RS0 = H - 88, RS1 = H - 44;
  const X = d => L + (R - L) * d / 365, Y = v => B - (B - T) * clamp(v / 6.4, 0, 1.2);
  const YR = v => RS1 - (RS1 - RS0) * clamp((v + 21) / 7);
  const g0 = D.gap[0], g1 = D.gap[1];
  const pA = seg(p, 0, 0.34), pB = seg(p, 0.34, 0.52), pC = seg(p, 0.52, 0.82), pD = seg(p, 0.82, 1);
  const cur = 365 * E.inOut(pA);
  const cloudIn = clamp((cur - g0) / (g1 - g0));
  const cloudA = (p > 0 ? 1 : 0) * (pA < 1 ? (cur > g0 ? 1 : 0) : 1) * (1 - 0.6 * E.out(pD));

  // grid and axes
  ctx.lineWidth = 1;
  for (let v = 0; v <= 6; v += 2) { ctx.strokeStyle = v === 0 ? "rgba(0,0,0,.16)" : "rgba(0,0,0,.065)"; ctx.beginPath(); ctx.moveTo(L, Math.round(Y(v)) + .5); ctx.lineTo(R, Math.round(Y(v)) + .5); ctx.stroke(); }
  ctx.font = `500 11px ${SANS}`; ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.textBaseline = "middle"; ctx.textAlign = "right";
  [0, 2, 4, 6].forEach(v => ctx.fillText(v, L - 9, Y(v)));
  ctx.textAlign = "left"; ctx.fillText("LAI", L, T - 17);
  ctx.fillText("Radar (VH)", L, RS0 - 10);
  ctx.strokeStyle = "rgba(0,0,0,.065)"; ctx.beginPath(); ctx.moveTo(L, RS1 + .5); ctx.lineTo(R, RS1 + .5); ctx.stroke();
  const MS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], MN = "JFMAMJJASOND";
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(0,0,0,.4)";
  MS.forEach((d, i) => ctx.fillText(MN[i], X(d + 15), H - 22));

  // hidden band, drawn like a cloud: a blue-grey band with white puffs
  const xb = X(lerp(g0, g1, pA < 1 ? cloudIn : 1));
  if (cloudA > 0.001) {
    const bx = X(g0) - 24, bw = X(g1) - X(g0) + 48, by = T - 26, bh = RS1 - T + 40;
    if (!S.band) S.band = document.createElement("canvas");
    const bc = S.band; if (bc.width !== Math.ceil(bw) || bc.height !== Math.ceil(bh)) { bc.width = Math.ceil(bw); bc.height = Math.ceil(bh); }
    const b = bc.getContext("2d"); b.globalCompositeOperation = "source-over"; b.clearRect(0, 0, bw, bh);
    b.fillStyle = "rgba(96,112,136,.28)"; b.fillRect(0, 0, bw, bh);
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const u = r(), v = r(), rad = 22 + r() * 56, ph = r() * 6.28;
      const cx = 24 + u * (bw - 48) + Math.sin(p * 5 + ph) * 9, cy = 16 + v * (bh - 32);
      const rg = b.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, "rgba(255,255,255,.95)"); rg.addColorStop(.5, "rgba(255,255,255,.6)"); rg.addColorStop(1, "rgba(255,255,255,0)");
      b.fillStyle = rg; b.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    b.globalCompositeOperation = "destination-in";
    const hg = b.createLinearGradient(0, 0, bw, 0); hg.addColorStop(0, "rgba(0,0,0,0)"); hg.addColorStop(.12, "#000"); hg.addColorStop(.88, "#000"); hg.addColorStop(1, "rgba(0,0,0,0)"); b.fillStyle = hg; b.fillRect(0, 0, bw, bh);
    const vgr = b.createLinearGradient(0, 0, 0, bh); vgr.addColorStop(0, "rgba(0,0,0,0)"); vgr.addColorStop(.16, "#000"); vgr.addColorStop(.86, "#000"); vgr.addColorStop(1, "rgba(0,0,0,0)"); b.fillStyle = vgr; b.fillRect(0, 0, bw, bh);
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, cloudIn >= 1 ? bw : Math.max(0, xb - bx), bh); ctx.clip();
    ctx.globalAlpha = cloudA; ctx.drawImage(bc, bx, by, bw, bh); ctx.restore();
    cloudChip(ctx, W, (X(g0) + X(g1)) / 2, T - 12, "103 days hidden", cloudA * clamp((xb - X(g0)) / 60));
  }

  // straight line through the gap
  const pInt = E.inOut(seg(pC, 0, 0.7));
  if (pInt > 0) {
    ctx.save(); ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(0,0,0,.38)";
    ctx.beginPath(); const d1 = lerp(g0, g1, pInt); let first = true;
    for (let i = 0; i < D.t.length; i++) { const d = D.t[i]; if (d < g0 - 6 || d > d1) continue; const px = X(d), py = Y(D.interp[i]); first ? ctx.moveTo(px, py) : ctx.lineTo(px, py); first = false; }
    ctx.stroke(); ctx.restore();
  }

  // model: uncertainty band and line
  if (pC > 0) {
    const dC = 365 * E.inOut(pC), up = [], lo = [];
    for (let i = 0; i < D.t.length; i++) { if (D.t[i] > dC) break; up.push([X(D.t[i]), Y(D.mean[i] + D.std[i])]); lo.push([X(D.t[i]), Y(Math.max(0, D.mean[i] - D.std[i]))]); }
    if (up.length > 1) {
      ctx.beginPath(); up.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); for (let i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0], lo[i][1]); ctx.closePath();
      const bg = ctx.createLinearGradient(0, T, 0, B); bg.addColorStop(0, rgb(ORANGE, .22)); bg.addColorStop(1, rgb(ORANGE, .09)); ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.strokeStyle = rgb(ORANGE);
      ctx.beginPath(); for (let i = 0; i < D.t.length; i++) { if (D.t[i] > dC) break; const px = X(D.t[i]), py = Y(D.mean[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
      if (pC < 1) { ctx.fillStyle = rgb(ORANGE); ctx.beginPath(); ctx.arc(X(dC), Y(interpAt(D.t, D.mean, dC)), 4, 0, 7); ctx.fill(); }
    }
  }

  // optical observations
  for (const [d, v] of D.ctx) {
    const s = p === 0 ? 0 : clamp((cur - d) / 10);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - s)})`; ctx.beginPath(); ctx.arc(X(d), Y(v), 2.4, 0, 7); ctx.fill();
    if (s > 0) { ctx.fillStyle = rgb(INK); ctx.beginPath(); ctx.arc(X(d), Y(v), 2.9 * E.back(s), 0, 7); ctx.fill(); }
  }
  // the real values under the cloud: visible first, hidden when the cloud rolls over them
  if (pD <= 0) for (const [d, v] of D.held) {
    const hid = p === 0 ? 0 : pA >= 1 ? 1 : clamp((xb - X(d) + 12) / 14);
    if (hid >= 1) continue;
    ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - hid)})`; ctx.beginPath(); ctx.arc(X(d), Y(v), 2.4, 0, 7); ctx.fill();
  }
  // hidden real values come back
  if (pD > 0) {
    D.held.forEach(([d, v], i) => {
      const k = i / D.held.length, s = seg(pD, k * 0.55, k * 0.55 + 0.35); if (s <= 0) return;
      ctx.save(); ctx.globalAlpha = s; ctx.lineWidth = 1.6; ctx.fillStyle = "#FFF"; ctx.strokeStyle = rgb(INK);
      ctx.beginPath(); ctx.arc(X(d), Y(v), 3.6 * E.back(s), 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    });
  }

  // radar strip
  {
    const dR = p === 0 ? 0 : 365 * E.inOut(pB);
    ctx.save(); ctx.lineWidth = 1.3; ctx.strokeStyle = rgb(BLUE, .32); ctx.beginPath(); let st = false;
    for (let i = 0; i < D.t.length; i++) { const v = D.vh[i]; if (v == null) { st = false; continue; } const px = X(D.t[i]), py = YR(v); st ? ctx.lineTo(px, py) : ctx.moveTo(px, py); st = true; }
    ctx.stroke(); ctx.restore();
    if (dR > 0) {
      ctx.save(); ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.strokeStyle = rgb(BLUE); ctx.beginPath(); let s2 = false, hx = 0, hy = 0;
      for (let i = 0; i < D.t.length; i++) { if (D.t[i] > dR) break; const v = D.vh[i]; if (v == null) { s2 = false; continue; } hx = X(D.t[i]); hy = YR(v); s2 ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); s2 = true; }
      ctx.stroke();
      if (pB < 1 && s2) { ctx.fillStyle = rgb(BLUE); ctx.beginPath(); ctx.arc(hx, hy, 3.2, 0, 7); ctx.fill(); }
      ctx.restore();
      if (pB > 0 && pB < 1) {
        ctx.save();
        for (let i = 0; i < D.t.length; i += 3) { const d = D.t[i]; if (d < g0 || d > g1 || d > dR) continue; const age = (dR - d) / 40; if (age > 1) continue; ctx.strokeStyle = rgb(BLUE, 0.28 * (1 - age)); ctx.beginPath(); ctx.moveTo(X(d), RS0); ctx.lineTo(X(d), T); ctx.stroke(); }
        ctx.restore();
      }
    }
  }

  // optical cursor
  if (pA > 0 && pA < 1) {
    const cx = X(cur), gr = ctx.createLinearGradient(cx - 26, 0, cx, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.04)");
    ctx.fillStyle = gr; ctx.fillRect(cx - 26, T - 6, 26, B - T + 6); ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.moveTo(cx + .5, T - 6); ctx.lineTo(cx + .5, B); ctx.stroke();
  }

  // field tile
  let shown = null, src = "";
  if (pD > 0) shown = null;
  else if (pC > 0) { shown = interpAt(D.t, D.mean, 365 * E.inOut(pC)); src = "model"; }
  else if (pA > 0) {
    const inGap = cur > g0 && cur < g1;
    if (!inGap) { shown = interpAt(D.ctx.map(c => c[0]), D.ctx.map(c => c[1]), cur); src = "optical"; } else { shown = null; src = "hidden"; }
    if (pA >= 1) { shown = null; src = pB > 0 ? "radar" : "hidden"; }
  }
  if (tile) {
    const s = tile, x0 = 26, y0 = Math.round((T + RS1) / 2 - s / 2 - 8);
    const soil = hex("#8A7A62"), leaf = hex("#6FB64E"), dense = hex("#3E8F2D");
    const v = shown == null ? (S.lastV || 0.3) : shown; if (shown != null) S.lastV = shown;
    const t = clamp(v / 5.6), col = t < 0.6 ? mix(soil, leaf, t / 0.6) : mix(leaf, dense, (t - 0.6) / 0.4);
    ctx.save(); roundRect(ctx, x0, y0, s, s, 10); ctx.clip();
    ctx.fillStyle = rgb(col); ctx.fillRect(x0, y0, s, s);
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 2;
    for (let i = -s; i < s * 2; i += 9) { ctx.beginPath(); ctx.moveTo(x0 + i, y0); ctx.lineTo(x0 + i - s * 0.55, y0 + s); ctx.stroke(); }
    const cloudy = (src === "hidden" || src === "radar") ? 1 : 0;
    S.cl = lerp(S.cl || 0, cloudy, 0.18); if (p === 0 || w.frozen) S.cl = cloudy;
    if (S.cl > 0.01) {
      ctx.fillStyle = `rgba(236,239,244,${0.86 * S.cl})`; ctx.fillRect(x0, y0, s, s);
      const r2 = rng(3); for (let i = 0; i < 7; i++) { const cx = x0 + r2() * s, cy = y0 + r2() * s, rad = 18 + r2() * 26; const rg = ctx.createRadialGradient(cx + Math.sin(p * 6 + i) * 4, cy, 0, cx, cy, rad); rg.addColorStop(0, `rgba(255,255,255,${0.7 * S.cl})`); rg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = rg; ctx.fillRect(x0, y0, s, s); }
    }
    ctx.restore();
    ctx.lineWidth = src === "model" ? 2 : 1; ctx.strokeStyle = src === "model" ? rgb(ORANGE) : "rgba(0,0,0,.12)"; roundRect(ctx, x0 + .5, y0 + .5, s - 1, s - 1, 10); ctx.stroke();
    if (pB > 0 && pB < 1) for (let k = 0; k < 3; k++) { const ph = (pB * 3 + k / 3) % 1; ctx.strokeStyle = rgb(BLUE, 0.55 * (1 - ph)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x0 + s / 2, y0 + s / 2, 10 + ph * 58, 0, 7); ctx.stroke(); }
    ctx.font = `500 11px ${SANS}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.fillText("Field", x0, y0 - 12);
    ctx.font = `600 11px ${SANS}`;
    ctx.fillStyle = src === "model" ? rgb(ORANGE_INK) : src === "radar" ? rgb(BLUE) : src === "optical" ? rgb(INK) : "rgba(0,0,0,.42)";
    ctx.fillText(p === 0 ? "Vendée, 2022" : pD > 0 ? "Rebuilt" : cap1(src), x0, y0 + s + 20);
  }

  // readout
  let html = "";
  if (pD > 0) { const a = E.out(pD); html = `Error: model<b class="o">${(D.rmse_model * a).toFixed(2)}</b><i>straight line</i><b>${(D.rmse_interp * a).toFixed(2)}</b>`; }
  else if (shown != null) html = `LAI<b>${shown.toFixed(2)}</b>`;
  else if (pA > 0) html = `LAI<b style="color:var(--text-3)">?</b>`;
  setRead(w, html);
}

/* ---------- 02 field boundary ---------- */
const FIELD_IMG = new Image();
function drawField(w, ctx, W, H, p) {
  const D = DATA.sam, [iw, ih] = D.size, S = w.state;
  if (!S.bb) { const xs = D.declared.map(q => q[0]), ys = D.declared.map(q => q[1]); S.bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  const fit = Math.max(W / iw, H / ih) * 1.04;
  const cx = (S.bb[0] + S.bb[2]) / 2, cy = (S.bb[1] + S.bb[3]) / 2 + 10;
  let ox = W / 2 - cx * fit, oy = H / 2 - cy * fit;
  ox = Math.min(0, Math.max(W - iw * fit, ox)); oy = Math.min(0, Math.max(H - ih * fit, oy));
  const P = q => [ox + q[0] * fit, oy + q[1] * fit];
  const pA = seg(p, 0, 0.12), pB = seg(p, 0.12, 0.38), pC = seg(p, 0.38, 0.60), pD = seg(p, 0.60, 0.86), pE = seg(p, 0.86, 1);
  if (FIELD_IMG.complete && FIELD_IMG.naturalWidth) ctx.drawImage(FIELD_IMG, ox, oy, iw * fit, ih * fit);
  else { ctx.fillStyle = "#6B7560"; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = `rgba(0,0,0,${lerp(0.34, 0.16, E.out(seg(p, 0, 0.3)))})`; ctx.fillRect(0, 0, W, H);

  const click = P(D.click);
  const wrong = D.candidates[1].poly.map(P), win = D.candidates[0].poly.map(P), dec = D.declared.map(P);
  const path = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

  // 2. wrong first guess (SAM2 top score)
  const wrongA = E.out(pB) * (1 - E.inOut(seg(p, 0.46, 0.66)));
  if (wrongA > 0.001) {
    const maxR = Math.max(...wrong.map(([x, y]) => Math.hypot(x - click[0], y - click[1])));
    ctx.save(); ctx.beginPath(); ctx.arc(click[0], click[1], maxR * E.out(pB) + 2, 0, 7); ctx.clip();
    path(wrong); ctx.fillStyle = rgb(RED, 0.30 * wrongA); ctx.fill();
    ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.strokeStyle = rgb(RED, wrongA); ctx.stroke(); ctx.restore();
    const top = Math.min(...wrong.map(q => q[1]));
    chip(ctx, W, click[0], Math.max(54, top - 18), "SAM2 score 0.94, IoU 0.32", RED_INK, wrongA * seg(pB, 0.35, 0.8));
  }
  // 3. re-prompts around the click
  if (pC > 0) {
    D.jitter.forEach((q, k) => {
      const s = seg(pC, k * 0.09, k * 0.09 + 0.36); if (s <= 0) return;
      const [x, y] = P(q), fade = 1 - 0.65 * E.out(seg(p, 0.7, 0.9));
      ctx.save(); ctx.globalAlpha = fade;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * s})`; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(click[0], click[1]); ctx.lineTo(lerp(click[0], x, E.out(s)), lerp(click[1], y, E.out(s))); ctx.stroke(); ctx.setLineDash([]);
      if (s > 0.5) { const t = (s - 0.5) * 2; ctx.fillStyle = "#FFF"; ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3.6 * E.back(t), 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - t)})`; ctx.beginPath(); ctx.arc(x, y, 4 + 12 * t, 0, 7); ctx.stroke(); }
      ctx.restore();
    });
  }
  // 4. the most stable mask wins
  if (pD > 0) {
    const L = S.winL && S.winW === W && S.winH === H ? S.winL : (S.winL = polyLen(win.concat([win[0]])), S.winW = W, S.winH = H, S.winL);
    const fillA = E.out(seg(pD, 0.55, 1));
    if (fillA > 0) { path(win); ctx.fillStyle = rgb(ORANGE, 0.2 * fillA); ctx.fill(); }
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = rgb(ORANGE);
    partialPath(ctx, win.concat([win[0]]), L, E.inOut(seg(pD, 0, 0.78))); ctx.stroke(); ctx.restore();
    const top = Math.min(...win.map(q => q[1]));
    chip(ctx, W, click[0], Math.max(54, top - 20), "Most stable mask: kept", ORANGE_INK, seg(pD, 0.5, 0.9) * (1 - seg(pE, 0, 0.4)));
  }
  // 5. declared boundary
  if (pE > 0) {
    ctx.save(); ctx.globalAlpha = E.out(pE); ctx.setLineDash([6, 6]); ctx.lineDashOffset = -p * 40; ctx.lineWidth = 1.7; ctx.strokeStyle = "#FFF"; path(dec); ctx.stroke(); ctx.restore();
  }
  // 1. the click
  if (pA > 0 && pA < 1) for (let k = 0; k < 2; k++) { const t = clamp(pA * 1.4 - k * 0.3); if (t <= 0 || t >= 1) continue; ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - t)})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(click[0], click[1], 6 + 34 * E.out(t), 0, 7); ctx.stroke(); }
  ctx.fillStyle = rgb(INK); ctx.beginPath(); ctx.arc(click[0], click[1], 8, 0, 7); ctx.fill();
  ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(click[0], click[1], 4.6, 0, 7); ctx.fill();

  let html = "";
  if (pE > 0) html = `IoU with the declared field<b class="o">${(0.97 * E.out(pE)).toFixed(2)}</b>`;
  else if (pD > 0) html = `IoU<b class="o">${lerp(0.32, 0.97, E.inOut(seg(pD, 0, 0.8))).toFixed(2)}</b>`;
  else if (pB > 0) html = `IoU<b class="r">${(0.32 * E.out(pB)).toFixed(2)}</b>`;
  setRead(w, html);
}

/* ---------- 03 crop types ---------- */
const CROP_COL = { wheat: "#E3A82B", barley: "#5D92DB", beet: "#C9557F", rapeseed: "#2FA392", grass: "#86C062", maize: "#9479CF", other: "#BBA580", nocrop: "#A39D93", none: "#D9D9DE" };
const CHECK = hex("#D9D9DE");
const NDVI_STOPS = [[0.10, hex("#E9E1D3")], [0.25, hex("#DDCDAF")], [0.42, hex("#CFC587")], [0.58, hex("#9CC765")], [0.74, hex("#6BB047")], [0.90, hex("#3F8F2E")]];
function ndviCol(v) { if (v <= NDVI_STOPS[0][0]) return NDVI_STOPS[0][1]; for (let i = 1; i < NDVI_STOPS.length; i++) if (v <= NDVI_STOPS[i][0]) { const [a, ca] = NDVI_STOPS[i - 1], [b, cb] = NDVI_STOPS[i]; return mix(ca, cb, (v - a) / (b - a)); } return NDVI_STOPS[NDVI_STOPS.length - 1][1]; }
const MONTHS = ["Dec 2024", "Jan 2025", "Feb 2025", "Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025"];
function initCrops(w) {
  if (!DATA.crops._ready) {
    for (const f of DATA.crops.fields) { let sx = 0, sy = 0; for (const q of f.p) { sx += q[0]; sy += q[1]; } f.cx = sx / f.p.length; f.cy = sy / f.p.length; f.col = hex(CROP_COL[f.k ? f.c : "none"] || CROP_COL.other); }
    DATA.crops._ready = true;
  }
  const pc = document.createElement("canvas"); pc.width = pc.height = 8; const g = pc.getContext("2d");
  g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.stroke(); w.state.hatchSrc = pc;
}
function drawCrops(w, ctx, W, H, p) {
  const D = DATA.crops, S = w.state;
  const fit = Math.max(W / D.w, H / D.h), ox = (W - D.w * fit) / 2, oy = (H - D.h * fit) / 2;
  if (!S.hatch) S.hatch = ctx.createPattern(S.hatchSrc, "repeat");
  const pA = seg(p, 0, 0.58), pB = seg(p, 0.58, 0.86), pC = seg(p, 0.86, 1);
  const m = pA * 11, mi = Math.min(10, Math.floor(m)), mf = m - mi;
  const sweep = lerp(ox - 60, ox + D.w * fit + 60, E.inOut(pB));
  const idle = hex("#E4E4E9");
  let named = 0;
  for (const f of D.fields) {
    const n = f.n.length === 12 ? lerp(f.n[mi], f.n[mi + 1], mf) / 100 : 0.2;
    let col = f.n.length === 12 ? ndviCol(n) : idle;
    const tc = clamp((sweep - (ox + f.cx * fit)) / 70);
    if (tc > 0) { col = mix(col, f.k ? f.col : CHECK, E.out(tc)); if (f.k && tc > 0.5) named++; }
    ctx.beginPath(); f.p.forEach((q, i) => { const x = ox + q[0] * fit, y = oy + q[1] * fit; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
    ctx.fillStyle = rgb(col); ctx.fill();
    if (!f.k && tc > 0) { ctx.save(); ctx.globalAlpha = E.out(tc); ctx.fillStyle = S.hatch; ctx.fill(); ctx.restore(); }
    ctx.lineWidth = 1.3; ctx.strokeStyle = "#F5F5F7"; ctx.stroke();
  }
  if (pB > 0 && pB < 1) {
    const gr = ctx.createLinearGradient(sweep - 90, 0, sweep, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,.45)");
    ctx.fillStyle = gr; ctx.fillRect(sweep - 90, 0, 90, H);
    ctx.strokeStyle = "rgba(29,29,31,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sweep, 0); ctx.lineTo(sweep, H); ctx.stroke();
  }
  { const bs = ctx.createLinearGradient(0, H - 92, 0, H); bs.addColorStop(0, "rgba(245,245,247,0)"); bs.addColorStop(1, `rgba(245,245,247,${Math.max(0.6, 0.94 * pC)})`); ctx.fillStyle = bs; ctx.fillRect(0, H - 92, W, 92); }
  w.legend.style.opacity = E.out(pC);
  let html = "";
  if (pB > 0) html = `classified<b>${named}</b> of ${D.fields.length}`;
  else if (pA > 0) html = `<b>${MONTHS[Math.round(m)]}</b>`;
  setRead(w, html);
}

/* ---------- 04 documents (illustration) ---------- */
function initDocs(w) {
  w.lines = $$(".jl", w.stage).map(el => ({ el, k: +el.dataset.k, v: $(".v", el) }));
  w.match = $(".match", w.stage); w.bars = $$(".mrow .bar i", w.stage); w.checks = $$(".checks span", w.stage);
  w.onResize = () => { w.state.anchors = null; };
}
function docsAnchors(w) {
  const sr = w.stage.getBoundingClientRect();
  const at = el => { const r = el.getBoundingClientRect(); return [r.left - sr.left, r.top - sr.top + r.height / 2]; };
  const a = w.lines.filter(l => l.k >= 0 && l.k <= 4).map(l => at(l.el));
  a.brace = at(w.lines.find(l => l.k < 0).el);
  return a;
}
function drawDocs(w, ctx, W, H, p) {
  const S = w.state; if (!S.anchors) S.anchors = docsAnchors(w);
  const stacked = W < 440;
  const pA = seg(p, 0, 0.22), pB = seg(p, 0.22, 0.50), pC = seg(p, 0.50, 0.80), pD = seg(p, 0.80, 1);
  const availH = stacked ? H - 52 - 322 : H - 72;
  const pw = Math.min(stacked ? W * 0.62 : W * 0.34, availH / 1.32), ph = pw * 1.32;
  const pcx = stacked ? W / 2 : Math.max(pw / 2 + 30, W * 0.25), pcy = 52 + availH / 2 + 4;
  const ang = -0.035, ca = Math.cos(ang), sa = Math.sin(ang);
  const toS = (x, y) => { const dx = x - pw / 2, dy = y - ph / 2; return [pcx + dx * ca - dy * sa, pcy + dx * sa + dy * ca]; };
  const onPage = f => { ctx.save(); ctx.translate(pcx, pcy); ctx.rotate(ang); ctx.translate(-pw / 2, -ph / 2); f(); ctx.restore(); };
  const cols = [0.08, 0.30, 0.50, 0.70, 0.84, 0.95], rows = 10, t0 = ph * .17, rh = (ph * .76) / rows;
  // the sheet
  onPage(() => {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.fillStyle = "#FFF"; ctx.fillRect(0, 0, pw, ph); ctx.restore();
    const r = rng(11);
    ctx.fillStyle = "#3A3A3C"; ctx.fillRect(pw * .08, ph * .06, pw * .42, 5); ctx.fillStyle = "#AEAEB2"; ctx.fillRect(pw * .08, ph * .06 + 10, pw * .26, 3); ctx.fillRect(pw * .66, ph * .06, pw * .26, 3);
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = .8;
    for (let i = 0; i <= rows; i++) { ctx.beginPath(); ctx.moveTo(pw * .06, t0 + i * rh); ctx.lineTo(pw * .95, t0 + i * rh); ctx.stroke(); }
    for (const c of cols.slice(1, 5)) { ctx.beginPath(); ctx.moveTo(pw * c - 3, t0); ctx.lineTo(pw * c - 3, t0 + rows * rh); ctx.stroke(); }
    for (let i = 0; i < rows; i++) for (let j = 0; j < 5; j++) {
      const x = pw * cols[j], cw = pw * (cols[j + 1] - cols[j]) - 8, bw = cw * (0.35 + r() * 0.55), y = t0 + i * rh + rh / 2;
      if (i === 0) { ctx.fillStyle = "#636366"; ctx.fillRect(x, y - 2, bw * .8, 3.5); continue; }
      if (j === 3 && r() > 0.25) { ctx.strokeStyle = "rgba(30,64,175,.7)"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x, y + 1); for (let s = 0; s < 6; s++) ctx.quadraticCurveTo(x + bw * (s + .5) / 6, y - 3 + (s % 2) * 5, x + bw * (s + 1) / 6, y + (r() - .5) * 2); ctx.stroke(); continue; }
      ctx.fillStyle = `rgba(60,60,67,${0.32 + r() * 0.28})`; ctx.fillRect(x, y - 1.5, bw, 3);
    }
    ctx.fillStyle = "rgba(0,0,0,.035)"; for (let i = 0; i < 260; i++) ctx.fillRect(r() * pw, r() * ph, 1, 1);
  });
  // scan line
  if (pA > 0 && pA < 1) {
    const yb = lerp(0, ph, E.inOut(pA));
    onPage(() => {
      const gr = ctx.createLinearGradient(0, yb - 46, 0, yb); gr.addColorStop(0, "rgba(242,140,0,0)"); gr.addColorStop(1, "rgba(242,140,0,.18)"); ctx.fillStyle = gr; ctx.fillRect(-6, yb - 46, pw + 12, 46);
      ctx.strokeStyle = rgb(ORANGE); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-8, yb); ctx.lineTo(pw + 8, yb); ctx.stroke();
    });
  }
  // boxes on the target row, and connectors to the JSON
  const tr = 4;
  for (let j = 0; j < 5; j++) {
    const s = seg(pB, j * 0.14, j * 0.14 + 0.32); if (s <= 0) continue;
    const x = pw * cols[j] - 4, cw = pw * (cols[j + 1] - cols[j]) - 2, y = t0 + tr * rh + 2, hh = rh - 4;
    onPage(() => { ctx.globalAlpha = E.out(s); roundRect(ctx, x, y, cw, hh, 3); ctx.fillStyle = rgb(ORANGE, j === 2 && pC > 0 ? 0.22 : 0.12); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = rgb(ORANGE); ctx.stroke(); });
    const a = stacked ? toS(x + cw / 2, y + hh) : toS(x + cw, y + hh / 2), b = S.anchors[j]; if (!b) continue;
    const cs = E.inOut(seg(s, 0.25, 1)); if (cs <= 0) continue;
    // phone: every value flows into the opening brace, so no line crosses the JSON text
    const end = stacked ? [S.anchors.brace[0] + 4, S.anchors.brace[1] - 10] : [b[0] - 8, b[1]];
    const c1 = stacked ? [a[0], a[1] + 70] : [a[0] + 60, a[1]], c2 = stacked ? [end[0], end[1] - 80] : [b[0] - 70, b[1]];
    ctx.save(); ctx.strokeStyle = rgb(ORANGE, 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    const N = 28; for (let i = 1; i <= N * cs; i++) { const t = i / N, u = 1 - t; ctx.lineTo(u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1]); }
    ctx.stroke(); ctx.fillStyle = rgb(ORANGE); ctx.beginPath(); ctx.arc(a[0], a[1], 2.6, 0, 7); ctx.fill(); ctx.restore();
  }
  // JSON lines type in
  for (const l of w.lines) {
    const s = l.k < 0 ? seg(pB, 0, 0.1) : l.k > 4 ? seg(pB, 0.9, 1) : seg(pB, l.k * 0.14 + 0.18, l.k * 0.14 + 0.36);
    l.el.style.opacity = s > 0 ? 1 : 0;
    if (l.v) {
      const final = l.v.dataset.final && pC > 0.72;
      const full = final ? l.v.dataset.final : l.v.dataset.full;
      const txt = full.slice(0, Math.round(full.length * (final ? seg(pC, 0.72, 0.92) : s)));
      if (l.v._t !== txt) { l.v.textContent = txt; l.v._t = txt; }
      l.v.classList.toggle("hl", !!final);
    }
  }
  w.match.style.opacity = E.out(seg(pC, 0, 0.2));
  w.bars.forEach((b, i) => { b.style.width = (100 * parseFloat(b.dataset.s) * E.out(seg(pC, 0.1 + i * 0.08, 0.6 + i * 0.08))) + "%"; });
  w.checks.forEach((c, i) => { const s = seg(pD, i * 0.22, i * 0.22 + 0.4); c.style.opacity = s; c.style.transform = `translateY(${(1 - E.out(s)) * 4}px)`; });
}

/* ---------- what each figure shows ---------- */
const SPEC = {
  lai: { draw: drawLAI, dur: 6200, caps: [
    [0, "Vendée, 2022. A field the model never saw."], [0.004, "Optical satellite: one value every few days"], [0.15, "Test: 103 days hidden, like a long cloudy spell"],
    [0.34, "Radar sees through cloud: no gap in its signal"], [0.52, "Reconstruction. Dashed: linear interpolation."], [0.82, "The hidden ground truth is revealed"], [1, "Vendée, 2022. 103 days reconstructed."]] },
  field: { draw: drawField, dur: 5600, caps: [
    [0, "Aerial photo, IGN. One click."], [0.004, "1. Click inside the field"], [0.12, "2. SAM2’s top mask locks onto a texture zone"],
    [0.38, "3. Re-prompt at 6 points around the click"], [0.60, "4. The most stable mask wins"], [0.86, "5. Compare with the declared parcel"], [1, "One click. The outline matches the declared parcel."]] },
  crop: { draw: drawCrops, dur: 5600, init: initCrops, caps: [
    [0, "340 real fields near Reims, season 2025"], [0.004, "Each crop greens up on its own calendar."],
    [0.58, "Grey: confidence below 0.9, routed to review."], [0.86, ""]],
    extra: `<div class="legend"><span><i style="background:#E3A82B"></i>Wheat</span><span><i style="background:#5D92DB"></i>Barley</span><span><i style="background:#C9557F"></i>Beet</span><span><i style="background:#2FA392"></i>Rapeseed</span><span><i style="background:#86C062"></i>Grass</span><span><i style="background:#D9D9DE"></i>To check</span></div>` },
  docs: { draw: drawDocs, dur: 6000, init: initDocs, caps: [
    [0, "A scanned record book page (illustration)"], [0.004, "1. A vision LLM reads the page image"], [0.22, "2. Each value lands in a strict JSON schema"],
    [0.50, "3. “Ammo 33,5” is matched to the catalogue"], [0.80, "4. Rules validate the record, then it is written"], [1, "Read by a vision LLM, matched, validated, written."]],
    extra: `<div class="panel"><div class="json">
      <div class="jl" data-k="-1"><span class="k">{</span></div>
      <div class="jl" data-k="0">&nbsp;&nbsp;<span class="k">"plot":</span> <span class="v" data-full='"Parcel 12",'></span></div>
      <div class="jl" data-k="1">&nbsp;&nbsp;<span class="k">"crop":</span> <span class="v" data-full='"Winter wheat",'></span></div>
      <div class="jl" data-k="2">&nbsp;&nbsp;<span class="k">"product":</span> <span class="v" data-full='"Ammo 33,5",' data-final='"Ammonitrate 33.5%",'></span></div>
      <div class="jl" data-k="3">&nbsp;&nbsp;<span class="k">"dose":</span> <span class="v" data-full='180, "unit": "kg/ha",'></span></div>
      <div class="jl" data-k="4">&nbsp;&nbsp;<span class="k">"date":</span> <span class="v" data-full='"2024-03-12"'></span></div>
      <div class="jl" data-k="5"><span class="k">}</span></div></div>
      <div class="match"><div class="h">Catalogue match, top 3 of 30</div>
      <div class="mrow top"><span class="n">Ammonitrate 33.5%</span><span class="bar"><i data-s="0.93"></i></span><span class="s">0.93</span></div>
      <div class="mrow"><span class="n">Ammonitrate 27%</span><span class="bar"><i data-s="0.71"></i></span><span class="s">0.71</span></div>
      <div class="mrow"><span class="n">Ammonium sulphate</span><span class="bar"><i data-s="0.42"></i></span><span class="s">0.42</span></div></div>
      <div class="checks"><span>✓ dose in range</span><span>✓ no duplicate</span><span>✓ saved</span></div></div>` },
};

/* ---------- engine ---------- */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NOHOVER = matchMedia("(hover: none)").matches;
const FREEZE = new URLSearchParams(location.search).get("p");
class Widget {
  constructor(stage) {
    const type = stage.dataset.widget, spec = SPEC[type];
    this.stage = stage; this.spec = spec; this.mode = stage.dataset.mode || "hover";
    stage.classList.add("w-" + type);
    stage.innerHTML = `<canvas></canvas><div class="cap">${spec.caps.map(([at, t]) => `<span data-at="${at}">${t}</span>`).join("")}</div><div class="read"></div>${spec.extra || ""}${this.mode === "hover" ? '<span class="hint">Hover to play</span>' : ""}`;
    this.canvas = $("canvas", stage); this.ctx = this.canvas.getContext("2d");
    this.caps = $$(".cap span", stage).map(s => ({ el: s, at: parseFloat(s.dataset.at) }));
    this.read = $(".read", stage); this.legend = $(".legend", stage); this.hint = $(".hint", stage);
    this.draw = spec.draw; this.dur = spec.dur; this.p = this.mode === "hover" ? 1 : 0; this.target = this.p; this.raf = 0; this.state = {};
    if (spec.init) spec.init(this);
    new ResizeObserver(() => { this.resize(); this.render(); }).observe(stage);
    if (this.mode === "hover") {
      const host = stage.closest(".card") || stage;
      if (!NOHOVER) host.addEventListener("mouseenter", () => this.replay());
      host.addEventListener("focus", () => this.replay());
    }
  }
  resize() {
    const r = this.stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height; this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (this.onResize) this.onResize(this);
  }
  go(t) {
    this.target = t; this.stage.classList.toggle("on", t > 0);
    if (this.frozen) { this.render(); return; }
    if (REDUCED) { this.p = 1; this.render(); this.done(); return; }
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(n => this.tick(n)); }
  }
  replay() { if (REDUCED) { this.go(1); return; } this.p = 0; this.go(1); }
  // the end of a play: the figure stays on its last frame and the pill invites a replay
  done() { this.played = true; this.stage.classList.remove("on"); if (this.hint) this.hint.textContent = "Hover to replay"; }
  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const fwd = this.target > this.p, speed = fwd ? 1000 / this.dur : 2600 / this.dur;
    this.p = fwd ? Math.min(this.target, this.p + dt * speed) : Math.max(this.target, this.p - dt * speed);
    this.render();
    this.raf = this.p !== this.target ? requestAnimationFrame(n => this.tick(n)) : 0;
    if (!this.raf && this.p >= 1) this.done();
  }
  render() {
    if (!this.W) return;
    const { ctx, W, H } = this; ctx.clearRect(0, 0, W, H);
    this.draw(this, ctx, W, H, this.p);
    this.stage.style.setProperty("--p", this.p.toFixed(4));
    let on = null; for (const c of this.caps) if (this.p >= c.at) on = c;
    for (const c of this.caps) c.el.classList.toggle("on", c === on);
  }
}

function boot() {
  const widgets = $$(".stage[data-widget]").map(s => new Widget(s));
  FIELD_IMG.onload = () => widgets.forEach(w => w.spec.draw === drawField && w.render());
  FIELD_IMG.src = new URL("field.jpg", BASE).href;
  widgets.forEach(w => { w.resize(); w.render(); });
  // touch screens have no hover: tell people to tap instead
  if (NOHOVER) $$("[data-tip]").forEach(el => { el.textContent = el.dataset.tip; });
  stackBoot();
  if (FREEZE !== null) { const v = parseFloat(FREEZE); widgets.forEach(w => { w.frozen = true; w.p = v; w.stage.classList.toggle("on", v > 0); w.render(); }); return; }
  if (REDUCED) { widgets.forEach(w => { w.p = 1; w.render(); }); return; }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const w = widgets.find(x => x.stage === e.target); if (!w) return;
      if (w.mode === "auto") { if (e.intersectionRatio > 0.35 && !w.played) { w.played = true; w.go(1); } return; }
      // grid cards: the first time a card comes into view, a phone plays it once, a computer pulses the pill
      if (e.intersectionRatio < 0.35 || w.seen) return;
      w.seen = true;
      if (NOHOVER) w.replay(); else w.stage.classList.add("nudge");
    }), { threshold: [0, 0.1, 0.35, 0.6, 1] });
    widgets.forEach(w => io.observe(w.stage));
  }
  $$("[data-replay]").forEach(btn => btn.addEventListener("click", () => { const st = btn.closest("figure").querySelector(".stage"); const w = widgets.find(x => x.stage === st); if (w) { w.played = true; w.replay(); } }));
}

/* ---------- the tool logos: they drop in a line, then hop into a pile ---------- */
function stackBoot() {
  const box = $("[data-stack]"); if (!box) return;
  const chips = $$(".chip", box), n = chips.length; if (!n) return;
  const hint = $(".hint", box), st = {};
  const place = () => {
    const W = box.clientWidth, H = box.clientHeight, s = chips[0].offsetWidth, gap = s < 40 ? 5 : 6, pad = 16;
    const inner = W - 2 * pad, floor = H - pad - s;
    // the line: as many rows as needed so that the chips do not overlap
    const lrows = Math.max(1, Math.ceil(n * (s + 4) / inner)), per = Math.ceil(n / lrows);
    const line = chips.map((c, i) => {
      const r = Math.floor(i / per), j = i % per, cnt = Math.min(per, n - r * per), step = cnt > 1 ? (inner - s) / (cnt - 1) : 0;
      return [pad + (cnt > 1 ? j * step : (inner - s) / 2), floor - (lrows - 1 - r) * (s + gap)];
    });
    // the pile: rows of b, b-1, b-2 ... chips, each row centred, like bricks
    const R = Math.max(1, Math.min(4, Math.floor((H - 2 * pad + gap) / (s + gap))));
    let b = Math.ceil((n + R * (R - 1) / 2) / R); b = Math.min(b, Math.floor((inner + gap) / (s + gap)));
    const pile = []; let left = n;
    for (let r = 0; left > 0; r++) {
      const c = Math.min(left, Math.max(1, b - r)), x0 = W / 2 - (c * (s + gap) - gap) / 2, y = floor - r * (s + gap);
      for (let j = 0; j < c; j++) pile.push([x0 + j * (s + gap), y]);
      left -= c;
    }
    return { line, pile };
  };
  const settle = () => { const { pile } = place(); chips.forEach((c, i) => { c.getAnimations().forEach(a => a.cancel()); c.style.opacity = 1; c.style.transform = `translate(${pile[i][0]}px,${pile[i][1]}px)`; }); };
  // the end: the chips are pinned in the pile with plain styles, so nothing depends on the animations staying alive
  const finish = () => { settle(); st.done = true; box.classList.remove("on"); box.classList.add("nudge"); if (hint) hint.textContent = "Hover to replay"; };
  const play = () => {
    if (REDUCED) { settle(); finish(); return; }
    const { line, pile } = place(); box.classList.add("on"); st.done = false;
    const drop = 60, hop = 55, t1 = n * drop + 420;
    clearTimeout(st.timer); st.timer = setTimeout(finish, t1 + n * hop + 520);
    chips.forEach((c, i) => {
      c.getAnimations().forEach(a => a.cancel()); c.style.opacity = ""; c.style.transform = "";
      const [lx, ly] = line[i], [px, py] = pile[i], top = Math.min(ly, py) - 70;
      c.animate([
        { transform: `translate(${lx}px,${ly - 90}px)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: `translate(${lx}px,${ly}px)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${lx}px,${ly - 12}px)`, opacity: 1, offset: 0.8 },
        { transform: `translate(${lx}px,${ly}px)`, opacity: 1 }], { duration: 560, delay: i * drop, fill: "forwards", easing: "ease-out" });
      c.animate([
        { transform: `translate(${lx}px,${ly}px)` },
        { transform: `translate(${(lx + px) / 2}px,${top}px)`, offset: 0.5 },
        { transform: `translate(${px}px,${py}px)` }], { duration: 480, delay: t1 + i * hop, fill: "forwards", easing: "ease-in-out" });
    });
  };
  if (!NOHOVER) box.addEventListener("mouseenter", () => { if (st.done) play(); });
  addEventListener("resize", () => { if (st.done) settle(); });
  if (FREEZE !== null || REDUCED || !("IntersectionObserver" in window)) { settle(); finish(); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio > 0.35 && !st.seen) { st.seen = true; play(); } }), { threshold: [0, 0.35, 1] });
  io.observe(box);
}

// a thin line under the menu once the page scrolls
const nav = $(".nav");
if (nav) { const f = () => nav.classList.toggle("scrolled", scrollY > 8); addEventListener("scroll", f, { passive: true }); f(); }

const start = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot);
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
