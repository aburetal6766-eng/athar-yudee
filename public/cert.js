// رسم شهادة الحضور على لوحة (Canvas) — المعاينة والطباعة وملف PDF من المصدر نفسه
(function (global) {
  'use strict';
  const LW = 1414, LH = 1000, SCALE = 1.75; // A4 أفقي
  const C = { bg: '#FCFAF4', teal: '#1D6F6A', tealDeep: '#174F4B', green: '#1F4D3A', gold: '#C9A54A', goldSoft: 'rgba(201,165,74,.16)', lilac: '#6A4C9C', ink: '#26302B', muted: '#5F6B65' };
  const AR = "'Tajawal', 'Segoe UI', Tahoma, 'DejaVu Sans', sans-serif";
  const DISPLAY = "'El Messiri', 'Tajawal', 'Segoe UI', Tahoma, 'DejaVu Sans', sans-serif";

  async function fontsReady() {
    if (!document.fonts) return;
    const specs = ['700 56px "El Messiri"', '600 30px "El Messiri"', '500 26px "Tajawal"', '700 26px "Tajawal"', '400 20px "Tajawal"'];
    await Promise.race([Promise.all(specs.map(s => document.fonts.load(s, 'شهادة حضور Where'))), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  }
  function loadImg(src) {
    return new Promise(res => {
      if (!src) return res(null);
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = src;
    });
  }
  function fill(tpl, d) {
    const L = d.lesson || {};
    const map = { 'الاسم': d.name, 'المادة': L.subject, 'عنوان_الدرس': L.title, 'الصف': L.grade, 'طريقة_التنفيذ': L.delivery, 'التاريخ': L.date, 'رقم_الشهادة': d.number, 'المقرر': L.course };
    return tpl.replace(/\{([^}]+)\}/g, (m, k) => (k in map ? (map[k] || '') : m));
  }
  function wrap(g, text, maxW) {
    const words = text.split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }
  function leaf(g, x, y, len, ang, color) {
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = color;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); g.fill();
    g.restore();
  }
  function sprig(g, x, y, ang, scale, color) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(scale, scale);
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(60, -10, 130, 10); g.stroke();
    for (let i = 0; i < 5; i++) { const t = 20 + i * 24; leaf(g, t, -1 + i * 1.6, 34 - i * 3, -0.9, color); leaf(g, t + 8, 2 + i * 1.6, 30 - i * 3, 0.75, color); }
    g.restore();
  }
  function pin(g, x, y, s, color) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = color;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-9, -14, -15, -20, -15, -30); g.arc(0, -30, 15, Math.PI, 0); g.bezierCurveTo(15, -20, 9, -14, 0, 0); g.fill();
    g.fillStyle = '#FCFAF4'; g.beginPath(); g.arc(0, -30, 5.5, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawImgCentered(g, im, cx, cy, w) {
    if (!im) return;
    const h = w * im.naturalHeight / im.naturalWidth;
    g.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  }

  // d: {name, number, status, header[], lesson{}, cert{title, body, showQr}, layout{}, verifyUrl}
  // imgs: {logo, stamp, sigVice, sigPrincipal} عناصر صور جاهزة أو روابط
  async function render(canvas, d, imgSrc = {}, opts = {}) {
    await fontsReady();
    const [logo, stamp, sigVice, sigPrincipal] = await Promise.all(['logo', 'stamp', 'sigVice', 'sigPrincipal'].map(k => loadImg(imgSrc[k])));
    const S = opts.scale || SCALE;
    canvas.width = Math.round(LW * S); canvas.height = Math.round(LH * S);
    const g = canvas.getContext('2d');
    g.setTransform(S, 0, 0, S, 0, 0);
    g.textBaseline = 'alphabetic';
    // الخلفية والإطار
    g.fillStyle = C.bg; g.fillRect(0, 0, LW, LH);
    // شريط الترويسة المائل (مستوحى من النموذج المدرسي)
    g.save();
    g.beginPath(); g.moveTo(LW - 34, 34); g.lineTo(LW - 470, 34); g.lineTo(LW - 380, 214); g.lineTo(LW - 34, 214); g.closePath();
    g.fillStyle = 'rgba(29,111,106,.07)'; g.fill();
    g.beginPath(); g.moveTo(LW - 520, 34); g.lineTo(LW - 470, 34); g.lineTo(LW - 380, 214); g.lineTo(LW - 430, 214); g.closePath();
    g.fillStyle = C.goldSoft; g.fill();
    g.restore();
    // زوايا ذهبية وخضراء
    g.save(); g.beginPath(); g.moveTo(34, LH - 34); g.lineTo(34, LH - 230); g.lineTo(230, LH - 34); g.closePath(); g.fillStyle = 'rgba(29,111,106,.08)'; g.fill(); g.restore();
    g.lineWidth = 3; g.strokeStyle = C.teal; g.strokeRect(22, 22, LW - 44, LH - 44);
    g.lineWidth = 1.2; g.strokeStyle = C.gold; g.strokeRect(34, 34, LW - 68, LH - 68);
    // زخرفة نباتية خفيفة
    sprig(g, 50, 170, 1.3, 0.85, 'rgba(29,111,106,.28)');
    sprig(g, LW - 52, LH - 70, Math.PI + 0.25, 0.9, 'rgba(201,165,74,.45)');

    // الترويسة (يمين)
    g.direction = 'rtl'; g.textAlign = 'right';
    (d.header || []).forEach((line, i) => {
      g.fillStyle = i === 0 ? C.tealDeep : C.teal;
      g.font = `${i < 2 ? 700 : 500} ${i < 2 ? 21 : 18}px ${AR}`;
      g.fillText(line, LW - 76, 86 + i * 30);
    });
    // الشعار (وسط)
    if (logo) drawImgCentered(g, logo, LW / 2, 118, Math.min(170, 120 * logo.naturalWidth / logo.naturalHeight));
    // رقم الشهادة (يسار)
    g.direction = 'ltr'; g.textAlign = 'left';
    g.fillStyle = C.muted; g.font = `500 16px ${AR}`;
    g.direction = 'rtl'; g.textAlign = 'left'; g.fillText('رقم الشهادة', 78, 86);
    g.direction = 'ltr'; g.fillStyle = C.tealDeep; g.font = `700 22px ${AR}`; g.fillText(d.number || '—', 78, 116);

    // العنوان
    g.direction = 'rtl'; g.textAlign = 'center';
    g.fillStyle = C.teal; g.font = `700 66px ${DISPLAY}`;
    g.fillText((d.cert && d.cert.title) || 'شهادة حضور', LW / 2, 250);
    // حلية: مسار منقط ودبوس
    g.strokeStyle = C.gold; g.lineWidth = 2; g.setLineDash([2, 7]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(LW / 2 - 210, 282); g.lineTo(LW / 2 - 26, 282); g.moveTo(LW / 2 + 26, 282); g.lineTo(LW / 2 + 210, 282); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.moveTo(LW / 2 - 210, 282); g.lineTo(LW / 2 - 222, 276); g.moveTo(LW / 2 - 210, 282); g.lineTo(LW / 2 - 222, 288); g.stroke();
    g.beginPath(); g.moveTo(LW / 2 + 210, 282); g.lineTo(LW / 2 + 222, 276); g.moveTo(LW / 2 + 210, 282); g.lineTo(LW / 2 + 222, 288); g.stroke();
    pin(g, LW / 2, 294, 0.72, C.lilac);

    // النص
    const lines = String((d.cert && d.cert.body) || '').split('\n').map(s => s.trim()).filter(Boolean);
    let y = 318;
    const blocks = lines.map(raw => {
      if (/^\{الاسم\}$/.test(raw)) return { kind: 'name', text: d.name || '' };
      if (/^\{عنوان_الدرس\}\.?$/.test(raw)) return { kind: 'title', text: fill(raw, d) };
      return { kind: 'body', text: fill(raw, d) };
    });
    for (const b of blocks) {
      if (b.kind === 'name') {
        let size = 58; g.font = `700 ${size}px ${DISPLAY}`;
        while (g.measureText(b.text).width > LW - 300 && size > 30) { size -= 2; g.font = `700 ${size}px ${DISPLAY}`; }
        y += 16; g.direction = 'rtl'; g.fillStyle = C.green; g.fillText(b.text, LW / 2, y + size * 0.55);
        const tw = Math.min(LW - 260, g.measureText(b.text).width + 80);
        g.strokeStyle = C.gold; g.lineWidth = 1.6; g.beginPath(); g.moveTo(LW / 2 - tw / 2, y + size * 0.55 + 20); g.lineTo(LW / 2 + tw / 2, y + size * 0.55 + 20); g.stroke();
        y += size * 0.55 + 44;
      } else if (b.kind === 'title') {
        g.direction = 'ltr'; g.font = `700 42px ${DISPLAY}`; g.fillStyle = C.lilac;
        y += 10; g.fillText(b.text, LW / 2, y + 30); y += 60;
      } else {
        g.direction = 'rtl'; g.font = `500 26px ${AR}`; g.fillStyle = C.ink;
        for (const ln of wrap(g, b.text, LW - 280)) { g.fillText(ln, LW / 2, y + 26); y += 40; }
      }
    }
    const L = d.lesson || {};
    // المعلمتان المنفذتان (دون توقيع)
    const ty = Math.max(y + 22, 662);
    g.direction = 'rtl'; g.textAlign = 'center';
    g.fillStyle = C.teal; g.font = `700 19px ${AR}`; g.fillText(L.teachersTitle || 'المعلمتان المنفذتان', LW / 2, ty);
    g.fillStyle = C.ink; g.font = `600 24px ${AR}`; g.fillText(L.teachers || '', LW / 2, ty + 34);

    const lay = d.layout || {};
    const col = (cx, title, name) => {
      g.fillStyle = C.teal; g.font = `700 19px ${AR}`; g.fillText(title || '', cx, 790);
      g.fillStyle = C.ink; g.font = `600 23px ${AR}`; g.fillText(name || '', cx, 824);
    };
    col(LW * 0.80, L.viceTitle, L.viceName);
    col(LW * 0.20, L.principalTitle, L.principalName);
    // الختم والتوقيعات — بالمواضع المعتمدة من لوحة المعلمة
    const place = (im, k) => { const p = lay[k]; if (im && p) drawImgCentered(g, im, p.x * LW, p.y * LH, p.w * LW); };
    place(stamp, 'stamp'); place(sigVice, 'sigVice'); place(sigPrincipal, 'sigPrincipal');
    if (opts.guides) {
      g.save(); g.setLineDash([6, 6]); g.strokeStyle = 'rgba(106,76,156,.7)'; g.lineWidth = 1.5;
      for (const k of ['stamp', 'sigVice', 'sigPrincipal']) { const p = lay[k]; if (!p) continue; const w = p.w * LW, h = k === 'stamp' ? w : w * 0.45; g.strokeRect(p.x * LW - w / 2, p.y * LH - h / 2, w, h); }
      g.restore();
    }
    // رمز التحقق
    if (d.cert && d.cert.showQr !== false && d.verifyUrl && global.QR) {
      global.QR.draw(g, d.verifyUrl, 62, LH - 186, 104, C.tealDeep, '#FFFFFF');
      g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = C.muted; g.font = `500 13px ${AR}`;
      g.fillText('امسحي للتحقق', 114, LH - 66);
    }
    // ملغاة
    if (d.status === 'revoked') {
      g.save(); g.translate(LW / 2, LH / 2); g.rotate(-0.32);
      g.strokeStyle = 'rgba(176,42,42,.75)'; g.lineWidth = 6; g.strokeRect(-260, -70, 520, 140);
      g.fillStyle = 'rgba(176,42,42,.8)'; g.font = `800 92px ${AR}`; g.direction = 'rtl'; g.textAlign = 'center'; g.fillText('شهادة ملغاة', 0, 32);
      g.restore();
    }
    return canvas;
  }

  // ملف PDF بسيط يحوي صورة الشهادة بدقة عالية (يحفظ الخط العربي كما يظهر تمامًا)
  function canvasToPdf(canvas) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
    const bin = atob(dataUrl.split(',')[1]);
    const jpg = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
    const PW = 841.89, PH = 595.28;
    const enc = new TextEncoder(); const chunks = []; let len = 0; const offs = [];
    const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10]));
    const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n${body}\nendobj\n`); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offs[4] = len;
    add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    add(jpg); add('\nendstream\nendobj\n');
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    let x = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    add(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  global.CertRenderer = { render, canvasToPdf, LW, LH };
})(window);
