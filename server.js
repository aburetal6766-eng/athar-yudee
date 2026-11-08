'use strict';
// منصة «أثرٌ يضيء» — خادم Node.js دون اعتماديات (عدا pg عند استخدام PostgreSQL).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./lib/store');
const { buildXlsx } = require('./lib/xlsx');
const defaults = require('./lib/defaults');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const store = new Store();

// ---------- أدوات ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const now = () => new Date().toISOString();
const rid = (n = 12) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const clean = (s, max = 4000) => String(s == null ? '' : s).replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, max);
const cleanName = s => clean(s, 120).replace(/\s+/g, ' ');

function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': isBuf ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers,
  });
  res.end(data);
}
const err = (res, code, message) => send(res, code, { error: message });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('حجم البيانات أكبر من المسموح'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(Object.assign(new Error('صيغة غير صالحة'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// حدّ بسيط لعدد الطلبات لكل عنوان IP
const buckets = new Map();
function limited(req, key, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = key + ':' + ip; const t = Date.now();
  const b = buckets.get(k) || { n: 0, t };
  if (t - b.t > windowMs) { b.n = 0; b.t = t; }
  b.n++; buckets.set(k, b);
  return b.n > max;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t - b.t > 3600e3) buckets.delete(k); }, 600e3).unref();

// ---------- الإعدادات ----------
function settings() {
  const d = defaults();
  const s = store.get('settings', null);
  if (!s) return d;
  // دمج سطحي حتى تظهر المفاتيح الجديدة بعد التحديثات دون فقد التعديلات
  const out = { ...d, ...s };
  for (const k of ['branding', 'lesson', 'cert', 'fields', 'certLayout']) out[k] = { ...d[k], ...(s[k] || {}) };
  return out;
}
const isOpen = () => store.get('open', true) !== false;

// ---------- مصادقة المعلمة ----------
function secret() {
  let s = process.env.SESSION_SECRET || store.get('secret', null);
  if (!s) { s = rid(48); store.set('secret', s).catch(() => {}); }
  return s;
}
function signToken(ttlHours = 12) {
  const exp = Date.now() + ttlHours * 3600e3;
  const ver = store.get('adminVer', 1);
  const payload = `${exp}.${ver}`;
  const sig = crypto.createHmac('sha256', secret()).update('admin.' + payload).digest('base64url');
  return `${payload}.${sig}`;
}
function checkToken(tok) {
  if (!tok) return false;
  const parts = String(tok).split('.');
  if (parts.length !== 3) return false;
  const [exp, ver, sig] = parts;
  if (Number(exp) < Date.now() || Number(ver) !== store.get('adminVer', 1)) return false;
  const good = crypto.createHmac('sha256', secret()).update(`admin.${exp}.${ver}`).digest('base64url');
  return good.length === sig.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}
function isAdmin(req) {
  const h = req.headers.authorization || '';
  return checkToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}
function verifyCode(code) {
  code = String(code || '');
  const stored = store.get('adminCodeHash', null);
  if (stored) {
    const [salt, hash] = stored.split(':');
    const h = crypto.scryptSync(code, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
  }
  const expected = String(process.env.ADMIN_CODE || 'A12345');
  const a = crypto.createHash('sha256').update(code).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- الإحصاءات ----------
function computeStats(s = settings()) {
  const ps = store.participants();
  const completed = ps.filter(p => p.status === 'completed');
  const perQ = s.questions.map(q => {
    const vals = completed.map(p => p.ratings && p.ratings[q.id]).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
    const dist = [1, 2, 3, 4, 5].map(n => vals.filter(v => v === n).length);
    return { id: q.id, text: q.text, required: q.required, count: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, dist };
  });
  const all = completed.flatMap(p => Object.values(p.ratings || {}).filter(v => Number.isInteger(v) && v >= 1 && v <= 5));
  return {
    registered: ps.length,
    completed: completed.length,
    incomplete: ps.length - completed.length,
    certsActive: completed.filter(p => p.cert && p.cert.status === 'active').length,
    certsRevoked: completed.filter(p => p.cert && p.cert.status === 'revoked').length,
    overallAvg: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null,
    answers: all.length,
    perQ,
    review: {
      new: completed.filter(p => (p.review?.status || 'new') === 'new').length,
      reviewed: completed.filter(p => p.review?.status === 'reviewed').length,
      followup: completed.filter(p => p.review?.status === 'followup').length,
    },
  };
}
const starsCount = () => store.participants().filter(p => p.status === 'completed').length;
function featuredOpinions() {
  return store.participants()
    .filter(p => p.status === 'completed' && p.review && p.review.featured && clean(p.comment))
    .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''))
    .map(p => ({ text: p.review.featuredText ? clean(p.review.featuredText) : clean(p.comment) }));
}
function assetMeta() { return store.get('assetMeta', {}); }

function publicConfig() {
  const s = settings();
  const meta = assetMeta();
  return {
    settings: {
      branding: s.branding, header: s.header, lesson: s.lesson, objectives: s.objectives,
      strategies: s.strategies, attachments: s.attachments.map(a => ({ id: a.id, title: a.title, type: a.type, url: a.type === 'link' ? a.url : `/files/${a.assetKey}`, fileName: a.fileName, note: a.note })),
      questions: s.questions, fields: s.fields,
    },
    open: isOpen(),
    stars: starsCount(),
    opinions: featuredOpinions(),
    logo: meta.logo ? `/asset/logo?v=${encodeURIComponent(meta.logo.updatedAt)}` : null,
  };
}

function certView(p) {
  const s = settings();
  const meta = assetMeta();
  const t = p.cert.token;
  const asset = k => meta[k] ? `/asset/${k}?t=${t}&v=${encodeURIComponent(meta[k].updatedAt)}` : null;
  return {
    name: p.name, number: p.cert.number, token: t, status: p.cert.status, issuedAt: p.cert.issuedAt,
    header: s.header, lesson: s.lesson, cert: s.cert, layout: s.certLayout,
    assets: { logo: meta.logo ? `/asset/logo?v=${encodeURIComponent(meta.logo.updatedAt)}` : null, stamp: asset('stamp'), sigVice: asset('sigVice'), sigPrincipal: asset('sigPrincipal') },
    platformName: s.branding.platformName,
  };
}

// ---------- مسارات الجمهور ----------
async function handlePublic(req, res, url) {
  const m = req.method;
  if (m === 'GET' && url.pathname === '/api/public/config') return send(res, 200, publicConfig());
  if (m === 'GET' && url.pathname === '/api/public/stats') return send(res, 200, { stars: starsCount(), open: isOpen() });

  if (m === 'GET' && url.pathname.startsWith('/api/cert/')) {
    const tok = url.pathname.slice('/api/cert/'.length);
    const p = store.findByToken(tok);
    if (!p) return err(res, 404, 'لم يتم العثور على هذه الشهادة. قد تكون حُذفت أو أن الرابط غير صحيح.');
    return send(res, 200, certView(p));
  }

  // استئناف مشاركة سابقة من الجهاز نفسه
  if (m === 'GET' && url.pathname.startsWith('/api/participation/')) {
    const id = url.pathname.slice('/api/participation/'.length);
    const p = store.findParticipant(id);
    if (!p) return err(res, 404, 'غير موجودة');
    return send(res, 200, { id: p.id, name: p.name, status: p.status, certToken: p.cert ? p.cert.token : null });
  }

  if (m === 'POST' && url.pathname === '/api/register') {
    if (limited(req, 'reg', 30, 60e3)) return err(res, 429, 'محاولات كثيرة، انتظري دقيقة ثم أعيدي المحاولة.');
    const b = await readBody(req, 16 * 1024);
    const id = clean(b.id, 64);
    const name = cleanName(b.name);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return err(res, 400, 'معرّف غير صالح');
    if (name.length < 3) return err(res, 400, 'اكتبي الاسم الكامل كما ترغبين في ظهوره على الشهادة.');
    return store.exclusive(async () => {
      const existing = store.findParticipant(id);
      if (existing) {
        if (existing.status !== 'completed' && existing.name !== name) { existing.name = name; await store.saveParticipant(existing); }
        return send(res, 200, { id, status: existing.status, certToken: existing.cert ? existing.cert.token : null });
      }
      if (!isOpen()) return err(res, 403, settings().branding.closedMessage);
      const p = { id, name, status: 'incomplete', createdAt: now(), src: clean(b.src, 20) || null, ratings: {}, comment: '', suggestions: '', review: { status: 'new', notes: '', category: '', internalRating: null, featured: false } };
      await store.saveParticipant(p);
      send(res, 200, { id, status: p.status, certToken: null });
    });
  }

  if (m === 'POST' && url.pathname === '/api/submit') {
    if (limited(req, 'sub', 30, 60e3)) return err(res, 429, 'محاولات كثيرة، انتظري دقيقة ثم أعيدي المحاولة.');
    const b = await readBody(req, 64 * 1024);
    const id = clean(b.id, 64);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return err(res, 400, 'معرّف غير صالح');
    return store.exclusive(async () => {
      const s = settings();
      let p = store.findParticipant(id);
      // إعادة الإرسال بعد نجاح سابق: نعيد الشهادة نفسها دون إصدار جديد
      if (p && p.status === 'completed') return send(res, 200, { ok: true, already: true, certToken: p.cert.token, number: p.cert.number });
      if (!isOpen()) return err(res, 403, s.branding.closedMessage);
      const name = cleanName(b.name);
      if (name.length < 3) return err(res, 400, 'اكتبي الاسم الكامل كما ترغبين في ظهوره على الشهادة.');
      const ratings = {};
      for (const q of s.questions) {
        const v = b.ratings ? b.ratings[q.id] : undefined;
        if (v === undefined || v === null || v === '') {
          if (q.required) return err(res, 400, `اختاري تقييمًا لمحور: ${q.text}`);
          continue;
        }
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 5) return err(res, 400, 'قيمة تقييم غير صالحة');
        ratings[q.id] = n;
      }
      const comment = clean(b.comment, 4000);
      const suggestions = clean(b.suggestions, 4000);
      if (s.fields.comment.required && !comment) return err(res, 400, `حقل «${s.fields.comment.label}» مطلوب.`);
      if (s.fields.suggestions.required && !suggestions) return err(res, 400, `حقل «${s.fields.suggestions.label}» مطلوب.`);
      if (!p) p = { id, createdAt: now(), src: clean(b.src, 20) || null, review: { status: 'new', notes: '', category: '', internalRating: null, featured: false } };
      const seq = store.get('certSeq', 0) + 1;
      await store.set('certSeq', seq);
      let token; do { token = rid(14); } while (store.findByToken(token));
      Object.assign(p, {
        name, ratings, comment, suggestions, status: 'completed', completedAt: now(),
        questionsSnapshot: s.questions.map(q => ({ id: q.id, text: q.text })),
        cert: { number: (s.cert.numberPrefix || '') + String(seq).padStart(4, '0'), token, status: 'active', issuedAt: now(), history: [] },
      });
      await store.saveParticipant(p);
      send(res, 200, { ok: true, certToken: token, number: p.cert.number });
    });
  }

  // الملفات: الشعار عام، والختم والتوقيعات لا تُعرض إلا مع رابط شهادة صالحة أو للمعلمة
  if (m === 'GET' && url.pathname.startsWith('/asset/')) {
    const key = url.pathname.slice(7);
    if (!['logo', 'stamp', 'sigVice', 'sigPrincipal'].includes(key)) return err(res, 404, 'غير موجود');
    if (key !== 'logo') {
      const p = store.findByToken(url.searchParams.get('t') || '');
      if (!(p && p.cert.status === 'active') && !isAdmin(req)) return err(res, 403, 'غير مصرح');
    }
    const a = await store.getAsset(key);
    if (!a) return err(res, 404, 'غير موجود');
    return send(res, 200, Buffer.from(a.data, 'base64'), { 'Content-Type': a.mime, 'Cache-Control': key === 'logo' ? 'public, max-age=86400' : 'private, max-age=3600' });
  }
  if (m === 'GET' && url.pathname.startsWith('/files/')) {
    const key = url.pathname.slice(7);
    const att = settings().attachments.find(a => a.type === 'file' && a.assetKey === key);
    if (!att) return err(res, 404, 'غير موجود');
    const a = await store.getAsset(key);
    if (!a) return err(res, 404, 'غير موجود');
    const fname = encodeURIComponent(att.fileName || a.name || 'file');
    return send(res, 200, Buffer.from(a.data, 'base64'), { 'Content-Type': a.mime || 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${fname}`, 'Cache-Control': 'public, max-age=3600' });
  }
  return null;
}

// ---------- مسارات المعلمة ----------
function adminParticipant(p) { return p; }
function validateSettings(inc, cur) {
  const s = { ...cur };
  const str = (v, max = 400) => clean(v, max);
  if (inc.branding) for (const k of Object.keys(cur.branding)) if (k in inc.branding) s.branding[k] = str(inc.branding[k], 1000);
  if (Array.isArray(inc.header)) s.header = inc.header.map(x => str(x, 200)).filter(Boolean).slice(0, 8);
  if (inc.lesson) for (const k of Object.keys(cur.lesson)) if (k in inc.lesson) s.lesson[k] = str(inc.lesson[k], 300);
  const list = (arr, map) => Array.isArray(arr) ? arr.slice(0, 60).map(map).filter(Boolean) : null;
  const o = list(inc.objectives, x => x && str(x.text, 300) ? { id: str(x.id, 20) || rid(6), text: str(x.text, 300) } : null); if (o) s.objectives = o;
  const st = list(inc.strategies, x => x && str(x.title, 200) ? { id: str(x.id, 20) || rid(6), title: str(x.title, 200), desc: str(x.desc, 1000) } : null); if (st) s.strategies = st;
  const at = list(inc.attachments, x => {
    if (!x || !str(x.title, 200)) return null;
    if (x.type === 'link') { const u = str(x.url, 1000); if (!/^https?:\/\//i.test(u)) return null; return { id: str(x.id, 20) || rid(6), title: str(x.title, 200), type: 'link', url: u, note: str(x.note, 300) }; }
    if (x.type === 'file') { const k = str(x.assetKey, 40); if (!/^att_[A-Za-z0-9_-]+$/.test(k)) return null; return { id: str(x.id, 20) || rid(6), title: str(x.title, 200), type: 'file', assetKey: k, fileName: str(x.fileName, 200), note: str(x.note, 300) }; }
    return null;
  }); if (at) s.attachments = at;
  const qs = list(inc.questions, x => x && str(x.text, 200) ? { id: /^[A-Za-z0-9_-]{1,20}$/.test(x.id || '') ? x.id : 'q' + rid(5), text: str(x.text, 200), required: !!x.required } : null);
  if (qs) { if (!qs.length) throw Object.assign(new Error('أبقي محورًا واحدًا على الأقل'), { status: 400 }); s.questions = qs; }
  if (inc.fields) for (const k of ['comment', 'suggestions']) if (inc.fields[k]) s.fields[k] = { label: str(inc.fields[k].label, 100) || cur.fields[k].label, required: !!inc.fields[k].required };
  if (inc.cert) { s.cert = { ...cur.cert }; if ('title' in inc.cert) s.cert.title = str(inc.cert.title, 100); if ('body' in inc.cert) s.cert.body = String(inc.cert.body || '').slice(0, 2000); if ('numberPrefix' in inc.cert) s.cert.numberPrefix = str(inc.cert.numberPrefix, 20); if ('showQr' in inc.cert) s.cert.showQr = !!inc.cert.showQr; }
  if (inc.certLayout) {
    s.certLayout = { ...cur.certLayout };
    for (const k of ['stamp', 'sigVice', 'sigPrincipal']) if (inc.certLayout[k]) {
      const v = inc.certLayout[k]; const c = (n, lo, hi, d) => { n = Number(n); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
      s.certLayout[k] = { x: c(v.x, 0, 1, 0.5), y: c(v.y, 0, 1, 0.85), w: c(v.w, 0.03, 0.5, 0.15) };
    }
  }
  if (Array.isArray(inc.categories)) s.categories = inc.categories.map(x => str(x, 60)).filter(Boolean).slice(0, 20);
  return s;
}

async function handleAdmin(req, res, url) {
  const m = req.method;
  if (m === 'POST' && url.pathname === '/api/admin/login') {
    if (limited(req, 'login', 8, 5 * 60e3)) return err(res, 429, 'محاولات كثيرة. انتظري خمس دقائق.');
    const b = await readBody(req, 4096);
    if (!verifyCode(b.code)) return err(res, 401, 'رمز الدخول غير صحيح');
    return send(res, 200, { token: signToken() });
  }
  if (!url.pathname.startsWith('/api/admin/')) return null;
  if (!isAdmin(req)) return err(res, 401, 'انتهت الجلسة، سجّلي الدخول مجددًا');

  const parts = url.pathname.split('/').filter(Boolean); // api admin x y z
  const [, , a1, a2, a3] = parts;

  if (m === 'GET' && a1 === 'data') {
    return send(res, 200, {
      settings: settings(), open: isOpen(), participants: store.participants().map(adminParticipant),
      stats: computeStats(), stars: starsCount(), assets: assetMeta(), storage: store.driver.name.startsWith('file') ? 'file' : 'postgres',
      codeFromEnv: !store.get('adminCodeHash', null),
    });
  }
  if (m === 'PUT' && a1 === 'settings') {
    const b = await readBody(req, 512 * 1024);
    return store.exclusive(async () => {
      const cur = JSON.parse(JSON.stringify(settings()));
      const next = validateSettings(b.settings || {}, cur);
      await store.set('settings', next);
      send(res, 200, { ok: true, settings: next });
    });
  }
  if (m === 'POST' && a1 === 'open') {
    const b = await readBody(req, 1024);
    await store.set('open', !!b.open);
    return send(res, 200, { ok: true, open: isOpen() });
  }
  if (a1 === 'participants' && a2) {
    return store.exclusive(async () => {
      const p = store.findParticipant(a2);
      if (!p) return err(res, 404, 'المشاركة غير موجودة');
      if (m === 'DELETE' && !a3) {
        // الحذف النهائي يلغي الشهادة (يختفي رابطها) ويحدّث الإحصاءات والخريطة
        await store.deleteParticipant(p.id);
        return send(res, 200, { ok: true });
      }
      if (m === 'PATCH' && !a3) {
        const b = await readBody(req, 64 * 1024);
        p.review = p.review || {};
        if ('status' in b && ['new', 'reviewed', 'followup'].includes(b.status)) p.review.status = b.status;
        if ('notes' in b) p.review.notes = clean(b.notes, 4000);
        if ('category' in b) p.review.category = clean(b.category, 60);
        if ('internalRating' in b) { const n = Number(b.internalRating); p.review.internalRating = Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; }
        if ('featured' in b) p.review.featured = !!b.featured;
        if ('featuredText' in b) p.review.featuredText = clean(b.featuredText, 4000);
        if ('name' in b) {
          const name = cleanName(b.name);
          if (name.length < 3) return err(res, 400, 'الاسم قصير جدًا');
          if (name !== p.name) {
            if (p.cert) { p.cert.history = p.cert.history || []; p.cert.history.push({ at: now(), action: 'rename', from: p.name, to: name }); }
            p.name = name;
          }
        }
        await store.saveParticipant(p);
        return send(res, 200, { ok: true, participant: p });
      }
      if (m === 'POST' && a3 === 'cert') {
        const b = await readBody(req, 1024);
        if (!p.cert) return err(res, 400, 'لا توجد شهادة لهذه المشاركة');
        if (b.action === 'revoke') p.cert.status = 'revoked';
        else if (b.action === 'reinstate') p.cert.status = 'active';
        else return err(res, 400, 'إجراء غير معروف');
        p.cert.history = p.cert.history || []; p.cert.history.push({ at: now(), action: b.action });
        await store.saveParticipant(p);
        return send(res, 200, { ok: true, participant: p });
      }
      return err(res, 404, 'غير موجود');
    });
  }
  if (a1 === 'assets' && a2) {
    const key = a2;
    const valid = ['logo', 'stamp', 'sigVice', 'sigPrincipal'].includes(key) || /^att_[A-Za-z0-9_-]{4,30}$/.test(key);
    if (!valid) return err(res, 400, 'مفتاح غير صالح');
    if (m === 'GET') {
      const a = await store.getAsset(key);
      if (!a) return err(res, 404, 'غير موجود');
      return send(res, 200, Buffer.from(a.data, 'base64'), { 'Content-Type': a.mime });
    }
    if (m === 'POST') {
      const b = await readBody(req, 22 * 1024 * 1024);
      const mime = clean(b.mime, 100);
      const data = String(b.data || '');
      if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return err(res, 400, 'ملف غير صالح');
      if (!key.startsWith('att_') && !/^image\/(png|jpeg|webp|svg\+xml)$/.test(mime)) return err(res, 400, 'ارفعي صورة PNG أو JPG أو WEBP');
      const size = Math.floor(data.length * 3 / 4);
      if (size > 16 * 1024 * 1024) return err(res, 413, 'الحد الأقصى للملف 16 ميجابايت');
      await store.putAsset(key, { mime, name: clean(b.name, 200), data });
      return store.exclusive(async () => {
        const meta = { ...assetMeta(), [key]: { mime, name: clean(b.name, 200), size, updatedAt: now() } };
        await store.set('assetMeta', meta);
        send(res, 200, { ok: true, meta: meta[key] });
      });
    }
    if (m === 'DELETE') {
      await store.deleteAsset(key);
      return store.exclusive(async () => {
        const meta = { ...assetMeta() }; delete meta[key];
        await store.set('assetMeta', meta);
        send(res, 200, { ok: true });
      });
    }
  }
  if (m === 'POST' && a1 === 'code') {
    const b = await readBody(req, 4096);
    if (!verifyCode(b.current)) return err(res, 401, 'الرمز الحالي غير صحيح');
    const next = String(b.next || '');
    if (next.length < 6) return err(res, 400, 'اختاري رمزًا من ٦ خانات على الأقل');
    const salt = rid(16);
    await store.set('adminCodeHash', salt + ':' + crypto.scryptSync(next, salt, 32).toString('hex'));
    await store.set('adminVer', store.get('adminVer', 1) + 1);
    return send(res, 200, { ok: true, token: signToken() });
  }
  if (m === 'GET' && a1 === 'export.xlsx') {
    const s = settings();
    const st = computeStats(s);
    const ps = store.participants().slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const statusAr = { new: 'جديدة', reviewed: 'تمت المراجعة', followup: 'تحتاج متابعة' };
    const fmt = d => { if (!d) return ''; const t = new Date(new Date(d).getTime() + 3 * 3600e3).toISOString(); return t.slice(0, 10) + ' ' + t.slice(11, 16); };
    const head = ['#', 'الاسم', 'الحالة', 'تاريخ التسجيل', 'تاريخ الإرسال', ...s.questions.map(q => q.text), 'متوسط الحاضرة', s.fields.comment.label, s.fields.suggestions.label, 'رقم الشهادة', 'حالة الشهادة', 'حالة المراجعة', 'التصنيف', 'معروض للعموم'];
    const rows = [head, ...ps.map((p, i) => {
      const vals = s.questions.map(q => p.ratings && p.ratings[q.id] ? p.ratings[q.id] : '');
      const nums = vals.filter(v => v !== '');
      return [i + 1, p.name, p.status === 'completed' ? 'مكتملة' : 'غير مكتملة', fmt(p.createdAt), fmt(p.completedAt), ...vals,
        nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : '', p.comment || '', p.suggestions || '',
        p.cert ? p.cert.number : '', p.cert ? (p.cert.status === 'active' ? 'معتمدة' : 'ملغاة') : '', p.status === 'completed' ? statusAr[p.review?.status || 'new'] : '', p.review?.category || '', p.review?.featured ? 'نعم' : ''];
    })];
    const res2 = [['المحور', 'عدد الإجابات', 'المتوسط', '١', '٢', '٣', '٤', '٥'],
      ...st.perQ.map(q => [q.text, q.count, q.avg == null ? '' : Math.round(q.avg * 100) / 100, ...q.dist]),
      [], ['المتوسط العام', st.answers, st.overallAvg == null ? '' : Math.round(st.overallAvg * 100) / 100],
      ['عدد المسجلات', st.registered], ['المشاركات المكتملة', st.completed], ['غير المكتملة', st.incomplete], ['الشهادات المعتمدة', st.certsActive], ['الشهادات الملغاة', st.certsRevoked]];
    // التقييم الداخلي للمعلمة في ورقة منفصلة عن تقييم الحاضرات
    const internal = [['الاسم', 'التقييم الداخلي للتعليق (١–٥)', 'التصنيف', 'حالة المراجعة', 'ملاحظات داخلية'],
      ...ps.filter(p => p.status === 'completed').map(p => [p.name, p.review?.internalRating || '', p.review?.category || '', statusAr[p.review?.status || 'new'], p.review?.notes || ''])];
    const buf = buildXlsx([
      { name: 'المشاركات', rows, widths: [5, 28, 12, 20, 20, ...s.questions.map(() => 14), 12, 40, 40, 16, 12, 14, 16, 10] },
      { name: 'النتائج', rows: res2, widths: [36, 14, 10, 6, 6, 6, 6, 6] },
      { name: 'المراجعة الداخلية', rows: internal, widths: [28, 16, 18, 16, 50] },
    ]);
    return send(res, 200, buf, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('أثر-يضيء-التقرير.xlsx')}` });
  }
  return err(res, 404, 'غير موجود');
}

// ---------- الملفات الثابتة ----------
const SPA = /^\/(|rate|map|admin|c\/[A-Za-z0-9_-]+|lesson)\/?$/;
function serveStatic(req, res, url) {
  let p = url.pathname;
  if (SPA.test(p)) p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return err(res, 403, 'غير مصرح');
  fs.readFile(file, (e, data) => {
    if (e) return err(res, 404, 'الصفحة غير موجودة');
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/admin/')) { const r = await handleAdmin(req, res, url); if (r !== null) return; }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/asset/') || url.pathname.startsWith('/files/')) {
      const r = await handlePublic(req, res, url);
      if (r === null && !res.headersSent) return err(res, 404, 'غير موجود');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return err(res, 405, 'غير مسموح');
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) err(res, e.status || 500, e.status ? e.message : 'حدث خطأ في الخادم، أعيدي المحاولة.');
    if (!e.status) console.error(e);
  }
});

store.init().then(() => {
  server.listen(PORT, () => console.log(`«أثرٌ يضيء» يعمل على المنفذ ${PORT} — التخزين: ${store.driver.name}`));
}).catch(e => { console.error('تعذر تشغيل التخزين:', e.message); process.exit(1); });
