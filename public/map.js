// خريطة الأثر: حدود تقريبية للمملكة العربية السعودية ونجمة رمزية لكل مشاركة مكتملة
(function (global) {
  'use strict';
  // [خط الطول، خط العرض] — تبسيط للحدود لأغراض العرض الرمزي
  const KSA = [[34.95, 29.36], [36.07, 29.19], [36.5, 29.5], [36.75, 29.87], [37.5, 30.0], [37.67, 30.34], [38.0, 30.5], [37.0, 31.5], [39.0, 32.0], [39.2, 32.16],
    [40.4, 31.9], [42.0, 31.1], [44.7, 29.2], [46.55, 29.1], [47.46, 29.0], [47.7, 28.53], [48.42, 28.55], [48.8, 27.7], [49.3, 27.2], [49.6, 26.9], [50.1, 26.6], [50.2, 26.0],
    [50.05, 25.6], [50.55, 25.1], [50.8, 24.75], [51.6, 24.25], [52.0, 23.0], [55.0, 22.6], [55.67, 22.0], [55.0, 20.0], [52.0, 19.0], [49.1, 18.6], [48.2, 18.2], [47.5, 17.1],
    [46.4, 17.25], [45.4, 17.33], [44.1, 17.4], [43.3, 17.55], [43.2, 16.7], [42.8, 16.4], [42.55, 16.85], [42.2, 17.4], [41.8, 17.9], [41.2, 18.9], [40.9, 19.5], [40.3, 20.2],
    [39.6, 20.8], [39.17, 21.5], [38.9, 22.2], [38.7, 22.6], [38.4, 23.2], [38.0, 24.0], [37.6, 24.4], [37.2, 25.0], [36.6, 25.8], [36.2, 26.4], [35.7, 27.35], [35.2, 28.0],
    [34.6, 28.1], [34.8, 28.6], [34.95, 29.36]];
  const LON0 = 34.2, LAT0 = 32.6, K = 50, CX = Math.cos(24 * Math.PI / 180);
  const proj = ([lon, lat]) => [(lon - LON0) * K * CX, (LAT0 - lat) * K];
  const PTS = KSA.map(proj);
  const W = Math.ceil((56.2 - LON0) * K * CX), H = Math.ceil((LAT0 - 15.8) * K);
  const PATH = 'M' + PTS.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ' Z';
  const ABU_ARISH = proj([42.83, 16.97]);

  function inside(x, y) {
    let c = false;
    for (let i = 0, j = PTS.length - 1; i < PTS.length; j = i++) {
      const [xi, yi] = PTS[i], [xj, yj] = PTS[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // مواضع ثابتة ومتباعدة للنجوم (مولّد عشوائي بذرة ثابتة) — رمزية ولا تمثل مواقع الحاضرات
  let cache = [];
  function positions(n) {
    if (cache.length >= n) return cache.slice(0, n);
    let seed = 1448 + cache.length * 7919;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    while (cache.length < n) {
      let best = null, bestD = -1;
      for (let t = 0; t < 24; t++) {
        const x = rnd() * W, y = rnd() * H;
        if (!inside(x, y)) { t--; continue; }
        let d = Infinity; for (const p of cache) d = Math.min(d, (p[0] - x) ** 2 + (p[1] - y) ** 2);
        if (d > bestD) { bestD = d; best = [x, y]; }
        if (cache.length > 400) break;
      }
      cache.push(best);
    }
    return cache.slice(0, n);
  }
  const starPath = (x, y, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1); }
    return d + 'Z';
  };

  function render(el, count, opts = {}) {
    const prev = Number(el.dataset.count || 0);
    const n = Math.max(0, count);
    const pts = positions(n);
    const r = n > 300 ? 6 : n > 120 ? 8 : 10;
    const stars = pts.map((p, i) => `<path class="star${i >= prev && el.dataset.ready ? ' star-new' : ''}" style="animation-delay:${(i % 9) * 0.37}s" d="${starPath(p[0], p[1], r)}"/>`).join('');
    const [ax, ay] = ABU_ARISH;
    el.innerHTML = `<svg viewBox="-20 -20 ${W + 40} ${H + 40}" role="img" aria-label="خريطة المملكة العربية السعودية وعليها ${n} نجمة، نجمة لكل مشاركة مكتملة">
      <defs>
        <radialGradient id="mapGlow" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2E6B52" stop-opacity=".12"/><stop offset="1" stop-color="#2E6B52" stop-opacity="0"/></radialGradient>
      </defs>
      
      <path d="${PATH}" class="ksa"/>
      <path d="${PATH}" class="ksa-edge"/>
      <path class="trail" d="M${ax} ${ay} C ${ax - 60} ${ay - 120}, ${ax - 200} ${ay - 160}, ${W * 0.46} ${H * 0.52}"/>
      ${stars}
      <g class="pin" transform="translate(${ax} ${ay})" aria-hidden="true">
        <path d="M0 0 C -9 -14 -15 -20 -15 -30 A 15 15 0 1 1 15 -30 C 15 -20 9 -14 0 0 Z"/>
        <circle cx="0" cy="-30" r="5.5" fill="#FFFDF8"/>
      </g>
    </svg>`;
    el.dataset.count = n; el.dataset.ready = '1';
  }
  global.AtharMap = { render };
})(window);
