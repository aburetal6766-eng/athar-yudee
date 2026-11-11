// «أثرٌ يضيء» — لوحة المعلمة
(function () {
  'use strict';
  let U, TOKEN = null, DATA = null, TAB = 'overview', EDIT = null, ASSET_URLS = {}, PENDING = {}, LAYOUT = null, refreshTimer = null;
  const deep = o => JSON.parse(JSON.stringify(o));
  const fmtDate = d => d ? new Date(d).toLocaleString('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }) : '—';
  const avgOf = p => { const v = Object.values(p.ratings || {}).filter(Number.isInteger); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const fix = n => n == null ? '—' : Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 1 : 0 });
  const REV = { new: ['جديدة', 'lilac'], reviewed: ['تمت المراجعة', 'ok'], followup: ['تحتاج متابعة', 'gold'] };
  const X = {
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    report: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-2"/>', qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  const ic = (n, c = '') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${X[n] || ''}</svg>`;
  const icon = n => X[n] ? ic(n) : U.icon(n);

  async function aapi(path, opts = {}) {
    const o = { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN, ...(opts.headers || {}) } };
    if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
    const r = await fetch(path, o);
    if (r.status === 401 && !path.endsWith('/login')) { logout(); throw new Error('انتهت الجلسة'); }
    if (opts.raw) { if (!r.ok) throw new Error('تعذر التحميل'); return r; }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
  }
  function logout() { try { sessionStorage.removeItem('athar.admin'); } catch (e) {} TOKEN = null; clearInterval(refreshTimer); loginView(); }

  function frame(inner) {
    const { esc } = U;
    const tabs = [['overview', 'chart', 'نظرة عامة'], ['participants', 'users', 'المشاركات'], ['certs', 'award', 'الشهادات'], ['content', 'edit', 'محتوى الدرس'], ['reports', 'report', 'التقارير'], ['links', 'qr', 'الروابط والدخول']];
    document.getElementById('app').innerHTML = `
      <header class="topbar"><div class="wrap">
        <a class="brand" href="/" target="_blank" rel="noopener"><svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1F4D3A"/><path d="M32 54C24 42 18 36 18 27a14 14 0 0 1 28 0c0 9-6 15-14 27z" fill="#9B7FD1"/><circle cx="32" cy="27" r="6" fill="#FAF6EC"/></svg>
          <span><b>لوحة المعلمة</b><small>${esc(DATA.settings.branding.platformName)}</small></span></a>
        <span class="badge ${DATA.open ? 'ok' : 'bad'}">${DATA.open ? 'التقييم مفتوح' : 'التقييم مغلق'}</span>
        <button class="btn btn-ghost btn-sm" data-refresh>${ic('refresh')} تحديث</button>
        <button class="btn btn-ghost btn-sm" data-logout>${ic('logout')} خروج</button>
      </div></header>
      <div class="wrap admin-shell">
        <nav class="admin-nav" aria-label="أقسام اللوحة">${tabs.map(t => `<button data-tab="${t[0]}" aria-current="${TAB === t[0]}">${ic(t[1])}${t[2]}</button>`).join('')}</nav>
        <main id="main" tabindex="-1">${inner}</main>
      </div>`;
    U.$$('[data-tab]').forEach(b => b.addEventListener('click', () => { if (TAB === 'content' && EDIT && EDIT.dirty && !confirm('لديكِ تعديلات غير محفوظة في محتوى الدرس. المتابعة دون حفظ؟')) return; TAB = b.dataset.tab; EDIT = null; draw(); }));
    U.$('[data-logout]').addEventListener('click', logout);
    U.$('[data-refresh]').addEventListener('click', async () => { await load(); draw(); U.toast('تم التحديث'); });
  }

  async function load() { DATA = await aapi('/api/admin/data'); }

  function loginView(msg) {
    const { esc } = U;
    document.getElementById('app').innerHTML = `<div class="wrap"><form class="card login" data-login>
      <span class="eyebrow">${U.icon('pin')} أثرٌ يضيء</span><h1>لوحة المعلمة</h1>
      <p class="muted">أدخلي رمز الدخول للوصول إلى المشاركات والشهادات والإعدادات.</p>
      ${msg ? `<p class="error" role="alert">${esc(msg)}</p>` : ''}
      <div class="field"><label for="code">رمز الدخول</label><input id="code" type="password" autocomplete="current-password" required dir="ltr"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">دخول</button>
      <p class="hint" style="margin-top:12px"><a href="/">العودة إلى المنصة</a></p></form></div>`;
    U.$('#code').focus();
    U.$('[data-login]').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const r = await aapi('/api/admin/login', { method: 'POST', body: { code: U.$('#code').value } });
        TOKEN = r.token; try { sessionStorage.setItem('athar.admin', TOKEN); } catch (er) {}
        await load(); draw();
      } catch (er) { loginView(er.message); }
    });
  }

  function draw() {
    clearInterval(refreshTimer);
    const views = { overview, participants, certs, content, reports, links };
    (views[TAB] || overview)();
    if (TAB === 'overview' || TAB === 'participants') refreshTimer = setInterval(async () => {
      if (document.querySelector('.drawer,.modal-back') || document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      try { const before = JSON.stringify(DATA.stats); await load(); if (JSON.stringify(DATA.stats) !== before) draw(); } catch (e) {}
    }, 20000);
  }

  // ---------- نظرة عامة ----------
  function overview() {
    const { esc, ar } = U; const s = DATA.stats;
    frame(`
      <h1>نظرة عامة</h1>
      ${DATA.storage === 'file' ? `<p class="notice" role="note"><b>تنبيه التخزين:</b> المنصة تحفظ البيانات في ملف على الخادم. على استضافة Render المجانية قد تُمسح الملفات عند إعادة التشغيل؛ اربطي قاعدة بيانات PostgreSQL (المتغير DATABASE_URL) قبل استقبال المشاركات.</p>` : ''}
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
        <div><h2 style="margin:0">استقبال التقييم</h2><p class="muted" style="margin:0">عند الإغلاق يبقى محتوى الدرس والشهادات الصادرة متاحًا، ويتوقف التسجيل والتقييم الجديد.</p></div>
        <label class="switch"><input type="checkbox" data-open ${DATA.open ? 'checked' : ''}> <span>${DATA.open ? 'مفتوح' : 'مغلق'}</span></label>
      </div>
      <div class="section stats">
        <div class="stat"><b>${ar(s.registered)}</b><span>المسجلات</span></div>
        <div class="stat"><b>${ar(s.completed)}</b><span>مشاركات مكتملة</span></div>
        <div class="stat"><b>${ar(s.incomplete)}</b><span>غير مكتملة</span></div>
        <div class="stat"><b>${ar(s.certsActive)}</b><span>شهادات معتمدة${s.certsRevoked ? ` · ${ar(s.certsRevoked)} ملغاة` : ''}</span></div>
        <div class="stat"><b>${fix(s.overallAvg)}</b><span>متوسط التقييم من ٥</span></div>
        <div class="stat"><b>${ar(DATA.stars)}</b><span>نجمة على خريطة الأثر</span></div>
      </div>
      <div class="card"><h2>نتائج المحاور</h2>
        <p class="hint">المتوسطات محسوبة من الإجابات الفعلية فقط (${ar(s.answers)} إجابة).</p>
        <div class="bars">${s.perQ.map(q => `<div class="bar-row"><span>${esc(q.text)} <small class="muted">(${ar(q.count)})</small></span>
          <div class="bar" role="img" aria-label="${esc(q.text)}: ${fix(q.avg)} من ٥"><i style="width:${q.avg ? q.avg / 5 * 100 : 0}%"></i></div><span class="bar-val">${fix(q.avg)}</span></div>`).join('')}</div>
      </div>
      <div class="card"><h2>متابعة المراجعة</h2>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" data-goto="new"><span class="badge lilac">${ar(s.review.new)}</span> جديدة</button>
          <button class="btn btn-ghost btn-sm" data-goto="reviewed"><span class="badge ok">${ar(s.review.reviewed)}</span> تمت المراجعة</button>
          <button class="btn btn-ghost btn-sm" data-goto="followup"><span class="badge gold">${ar(s.review.followup)}</span> تحتاج متابعة</button>
        </div>
      </div>`);
    U.$('[data-open]').addEventListener('change', async e => {
      const open = e.target.checked;
      if (!confirm(open ? 'فتح استقبال التقييم والتسجيل؟' : 'إغلاق التقييم؟ سيبقى المحتوى والشهادات الصادرة متاحة.')) { e.target.checked = !open; return; }
      await aapi('/api/admin/open', { method: 'POST', body: { open } }); DATA.open = open; U.toast(open ? 'تم فتح التقييم' : 'تم إغلاق التقييم'); draw();
    });
    U.$$('[data-goto]').forEach(b => b.addEventListener('click', () => { TAB = 'participants'; FILTER.f = b.dataset.goto; draw(); }));
  }

  // ---------- المشاركات ----------
  const FILTER = { q: '', f: 'all' };
  function filtered() {
    const q = FILTER.q.trim();
    return DATA.participants.filter(p => {
      if (q && !p.name.includes(q)) return false;
      const rs = p.review?.status || 'new';
      switch (FILTER.f) {
        case 'completed': return p.status === 'completed';
        case 'incomplete': return p.status !== 'completed';
        case 'new': case 'reviewed': case 'followup': return p.status === 'completed' && rs === FILTER.f;
        case 'featured': return !!p.review?.featured;
        default: return true;
      }
    }).sort((a, b) => (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || ''));
  }
  function participants() {
    const { esc, ar } = U;
    frame(`<h1>المشاركات</h1>
      <div class="toolbar">
        <label class="sr" for="q">بحث بالاسم</label><input id="q" type="search" placeholder="ابحثي بالاسم" value="${esc(FILTER.q)}">
        <label class="sr" for="f">تصفية</label>
        <select id="f">${[['all', 'الكل'], ['completed', 'المكتملة'], ['incomplete', 'غير المكتملة'], ['new', 'جديدة'], ['reviewed', 'تمت المراجعة'], ['followup', 'تحتاج متابعة'], ['featured', 'المعروضة للعموم']].map(o => `<option value="${o[0]}" ${FILTER.f === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      </div>
      <div data-table></div>`);
    const table = () => {
      const rows = filtered();
      U.$('[data-table]').innerHTML = rows.length ? `<p class="hint">${ar(rows.length)} مشاركة</p><div class="table-wrap"><table>
        <thead><tr><th>الاسم</th><th>الحالة</th><th>متوسطها</th><th>المراجعة</th><th>الشهادة</th><th>التاريخ</th></tr></thead>
        <tbody>${rows.map(p => { const r = REV[p.review?.status || 'new']; return `<tr class="clickable" data-id="${esc(p.id)}" tabindex="0">
          <td><b>${esc(p.name)}</b>${p.review?.featured ? ' <span class="badge gold">معروض</span>' : ''}</td>
          <td>${p.status === 'completed' ? '<span class="badge ok">مكتملة</span>' : '<span class="badge">غير مكتملة</span>'}</td>
          <td>${fix(avgOf(p))}</td>
          <td>${p.status === 'completed' ? `<span class="badge ${r[1]}">${r[0]}</span>` : '—'}</td>
          <td>${p.cert ? `<span class="ltr">${esc(p.cert.number)}</span> ${p.cert.status === 'revoked' ? '<span class="badge bad">ملغاة</span>' : ''}` : '—'}</td>
          <td><small>${fmtDate(p.completedAt || p.createdAt)}</small></td></tr>`; }).join('')}</tbody></table></div>`
        : '<p class="empty">لا توجد مشاركات مطابقة.</p>';
      U.$$('tr[data-id]').forEach(tr => { const open = () => drawer(tr.dataset.id); tr.addEventListener('click', open); tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); }); });
    };
    table();
    U.$('#q').addEventListener('input', e => { FILTER.q = e.target.value; table(); });
    U.$('#f').addEventListener('change', e => { FILTER.f = e.target.value; table(); });
  }

  function drawer(id) {
    const { esc, ar } = U; const p = DATA.participants.find(x => x.id === id); if (!p) return;
    const s = DATA.settings; const rv = p.review || {};
    const qs = (p.questionsSnapshot && p.questionsSnapshot.length ? p.questionsSnapshot : s.questions);
    const back = document.createElement('div'); back.className = 'drawer-back';
    const dr = document.createElement('aside'); dr.className = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', 'تفاصيل المشاركة');
    dr.innerHTML = `
      <h2><span>${esc(p.name)}</span><button class="icon-btn" data-x aria-label="إغلاق">${U.icon('close')}</button></h2>
      <dl class="kv"><dt>الحالة</dt><dd>${p.status === 'completed' ? 'مكتملة' : 'غير مكتملة (سجّلت الاسم ولم ترسل)'}</dd>
        <dt>التسجيل</dt><dd>${fmtDate(p.createdAt)}</dd>${p.completedAt ? `<dt>الإرسال</dt><dd>${fmtDate(p.completedAt)}</dd>` : ''}${p.src ? `<dt>المصدر</dt><dd>${esc(p.src)}</dd>` : ''}</dl>
      <div class="field" style="margin-top:14px"><label for="dn">الاسم على الشهادة</label><div class="link-line"><input id="dn" type="text" value="${esc(p.name)}" style="flex:1 1 200px"><button class="btn btn-ghost btn-sm" data-rename>حفظ الاسم</button></div>
        <span class="hint">تصحيح الاسم يحافظ على رقم الشهادة نفسه ورابطها.</span></div>
      ${p.status === 'completed' ? `
      <h3>تقييم الحاضرة للدرس</h3>
      <ul class="summary">${qs.map(q => `<li><span>${esc(q.text)}</span><b>${p.ratings && p.ratings[q.id] ? ar(p.ratings[q.id]) + ' / ٥' : '—'}</b></li>`).join('')}</ul>
      <h3 style="margin-top:14px">${esc(s.fields.comment.label)}</h3><div class="quote">${esc(p.comment) || '<span class="muted">—</span>'}</div>
      <h3 style="margin-top:14px">${esc(s.fields.suggestions.label)}</h3><div class="quote">${esc(p.suggestions) || '<span class="muted">—</span>'}</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
      <h3>المراجعة الداخلية <small class="muted">(لا تظهر للحاضرات)</small></h3>
      <div class="field"><span class="label">حالة المراجعة</span><div class="seg" data-seg="status">${Object.entries(REV).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${(rv.status || 'new') === k}">${v[0]}</button>`).join('')}</div></div>
      <div class="field"><label for="cat">التصنيف (اختياري)</label><input id="cat" type="text" list="cats" value="${esc(rv.category || '')}"><datalist id="cats">${(s.categories || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><span class="label">تقييم داخلي لفائدة التعليق (اختياري)</span>
        <div class="seg" data-seg="internalRating">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-v="${n}" aria-pressed="${rv.internalRating === n}">${ar(n)}</button>`).join('')}<button type="button" data-v="" aria-pressed="${!rv.internalRating}">بلا</button></div>
        <span class="hint">منفصل تمامًا عن تقييم الحاضرة للدرس ولا يدخل في المتوسطات.</span></div>
      <div class="field"><label for="notes">ملاحظات داخلية</label><textarea id="notes">${esc(rv.notes || '')}</textarea></div>
      <div class="field"><label class="switch"><input type="checkbox" id="feat" ${rv.featured ? 'checked' : ''}> عرض هذا الرأي للعموم دون الاسم</label>
        <span class="hint">يظهر في الصفحة الرئيسة وفي التقرير العام دون اسم ودون الملاحظات الداخلية. يمكنكِ تحرير النص المعروض أدناه.</span>
        <textarea id="ftext" ${rv.featured ? '' : 'disabled'} aria-label="النص المعروض للعموم">${esc(rv.featuredText || p.comment || '')}</textarea></div>
      <button class="btn btn-primary" data-save style="width:100%">حفظ المراجعة</button>
      <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
      <h3>الشهادة</h3>
      <dl class="kv"><dt>الرقم</dt><dd class="ltr" style="text-align:right">${esc(p.cert.number)}</dd><dt>الحالة</dt><dd><span class="badge ${p.cert.status === 'active' ? 'ok' : 'bad'}">${p.cert.status === 'active' ? 'معتمدة' : 'ملغاة'}</span></dd><dt>الإصدار</dt><dd>${fmtDate(p.cert.issuedAt)}</dd></dl>
      <div class="btn-row" style="margin-top:10px">
        <a class="btn btn-ghost btn-sm" href="/c/${esc(p.cert.token)}" target="_blank" rel="noopener">${ic('ext')} معاينة</a>
        <button class="btn btn-ghost btn-sm" data-pdf>${U.icon('download')} تنزيل PDF</button>
        <button class="btn btn-ghost btn-sm" data-copy>${U.icon('copy')} نسخ الرابط</button>
        ${p.cert.status === 'active' ? '<button class="btn btn-ghost btn-sm" data-cert="revoke">إلغاء الشهادة</button>' : '<button class="btn btn-ghost btn-sm" data-cert="reinstate">إعادة اعتماد الشهادة</button>'}
      </div>` : '<p class="notice" style="margin-top:14px">لم تُكمل هذه الحاضرة التقييم بعد، لذلك لا توجد شهادة.</p>'}
      <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
      <button class="btn btn-danger btn-sm" data-del>${ic('trash')} حذف المشاركة نهائيًا</button>`;
    document.body.append(back, dr);
    const close = () => { back.remove(); dr.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.modal-back')) close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', close); U.$('[data-x]', dr).addEventListener('click', close); U.$('[data-x]', dr).focus();
    const st = { status: rv.status || 'new', internalRating: rv.internalRating || null };
    U.$$('[data-seg]', dr).forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      U.$$('button', seg).forEach(x => x.setAttribute('aria-pressed', x === b));
      st[seg.dataset.seg] = seg.dataset.seg === 'internalRating' ? (b.dataset.v ? Number(b.dataset.v) : null) : b.dataset.v;
    }));
    const feat = U.$('#feat', dr); if (feat) feat.addEventListener('change', () => { U.$('#ftext', dr).disabled = !feat.checked; });
    const refresh = async msg => { await load(); close(); if (TAB === 'participants') participants(); else draw(); drawer(id); if (msg) U.toast(msg); };
    U.$('[data-rename]', dr).addEventListener('click', async () => {
      try { await aapi(`/api/admin/participants/${id}`, { method: 'PATCH', body: { name: U.$('#dn', dr).value } }); refresh('تم تصحيح الاسم مع الحفاظ على رقم الشهادة'); } catch (e) { U.toast(e.message); }
    });
    const save = U.$('[data-save]', dr);
    if (save) save.addEventListener('click', async () => {
      try {
        await aapi(`/api/admin/participants/${id}`, { method: 'PATCH', body: { status: st.status, internalRating: st.internalRating, category: U.$('#cat', dr).value, notes: U.$('#notes', dr).value, featured: feat.checked, featuredText: U.$('#ftext', dr).value } });
        refresh('تم حفظ المراجعة');
      } catch (e) { U.toast(e.message); }
    });
    const cb = U.$('[data-cert]', dr);
    if (cb) cb.addEventListener('click', async () => {
      const a = cb.dataset.cert;
      if (!confirm(a === 'revoke' ? 'إلغاء هذه الشهادة؟ سيظهر رابطها بحالة «ملغاة» ويتعطل تنزيلها.' : 'إعادة اعتماد الشهادة؟')) return;
      await aapi(`/api/admin/participants/${id}/cert`, { method: 'POST', body: { action: a } }); refresh(a === 'revoke' ? 'أُلغيت الشهادة' : 'أُعيد اعتماد الشهادة');
    });
    const pdf = U.$('[data-pdf]', dr); if (pdf) pdf.addEventListener('click', () => downloadCert(p));
    const cp = U.$('[data-copy]', dr); if (cp) cp.addEventListener('click', () => U.copy(location.origin + '/c/' + p.cert.token));
    U.$('[data-del]', dr).addEventListener('click', () => confirmDelete(p, async () => { close(); await load(); draw(); U.toast('حُذفت المشاركة وأُلغيت شهادتها وتحدّثت الخريطة'); }));
  }
  function confirmDelete(p, after) {
    const { esc } = U;
    const m = document.createElement('div'); m.className = 'modal-back';
    m.innerHTML = `<div class="modal" role="alertdialog" aria-labelledby="dh" aria-describedby="dd">
      <h2 id="dh">حذف المشاركة نهائيًا؟</h2>
      <p id="dd">ستُحذف مشاركة <b>${esc(p.name)}</b> بكل تقييماتها وآرائها، ${p.cert ? `وتُلغى شهادتها رقم <b class="ltr">${esc(p.cert.number)}</b> ويتوقف رابطها، ` : ''}وتُحدَّث الإحصاءات وخريطة الأثر. لا يمكن التراجع.</p>
      <label class="switch" style="margin:10px 0 16px"><input type="checkbox" data-ok> أفهم أن الحذف نهائي</label>
      <div class="btn-row"><button class="btn btn-danger" data-yes disabled>حذف نهائي</button><button class="btn btn-ghost" data-no>تراجع</button></div></div>`;
    document.body.appendChild(m);
    const yes = U.$('[data-yes]', m);
    U.$('[data-ok]', m).addEventListener('change', e => { yes.disabled = !e.target.checked; });
    U.$('[data-no]', m).addEventListener('click', () => m.remove());
    U.$('[data-no]', m).focus();
    yes.addEventListener('click', async () => { yes.disabled = true; try { await aapi(`/api/admin/participants/${p.id}`, { method: 'DELETE' }); m.remove(); after(); } catch (e) { U.toast(e.message); yes.disabled = false; } });
  }

  // ---------- الأصول والشهادة ----------
  async function assetUrl(key) {
    if (!DATA.assets[key]) return null;
    const stamp = DATA.assets[key].updatedAt;
    if (ASSET_URLS[key] && ASSET_URLS[key].v === stamp) return ASSET_URLS[key].url;
    try { const r = await aapi('/api/admin/assets/' + key, { raw: true }); const url = URL.createObjectURL(await r.blob()); ASSET_URLS[key] = { v: stamp, url }; return url; } catch (e) { return null; }
  }
  async function certImgs(pending) {
    const out = {};
    for (const k of ['logo', 'stamp', 'sigVice', 'sigPrincipal']) out[k] = (pending && PENDING[k]) ? PENDING[k].dataUrl : await assetUrl(k);
    return out;
  }
  function certData(p, settings, layout) {
    const s = settings || DATA.settings;
    return { name: p ? p.name : 'الاسم الكامل للحاضرة', number: p && p.cert ? p.cert.number : (s.cert.numberPrefix || '') + '0000', status: p && p.cert ? p.cert.status : 'active',
      header: s.header, lesson: s.lesson, cert: s.cert, layout: layout || s.certLayout, verifyUrl: location.origin + '/c/' + (p && p.cert ? p.cert.token : 'preview') };
  }
  async function downloadCert(p) {
    const c = document.createElement('canvas');
    await CertRenderer.render(c, certData(p), await certImgs(false));
    U.download(CertRenderer.canvasToPdf(c), `شهادة-${p.cert.number}-${p.name.replace(/\s+/g, '-')}.pdf`);
  }
  function readFile(file, asImage) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('تعذر قراءة الملف'));
      fr.onload = () => {
        if (!asImage) return resolve({ dataUrl: fr.result, mime: file.type || 'application/octet-stream', name: file.name });
        const im = new Image();
        im.onload = () => {
          const max = 1600, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          resolve({ dataUrl: c.toDataURL('image/png'), mime: 'image/png', name: file.name });
        };
        im.onerror = () => reject(new Error('الملف ليس صورة صالحة'));
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function certs() {
    const { esc, ar } = U;
    const s = DATA.settings;
    if (!LAYOUT) LAYOUT = deep(s.certLayout);
    const certSet = deep(s.cert);
    const list = DATA.participants.filter(p => p.cert).sort((a, b) => (a.cert.number).localeCompare(b.cert.number));
    const assetCard = (k, title, hint, hasPos) => `<div class="asset" data-asset="${k}">
      <b>${title}</b><div class="thumb" data-thumb><span class="muted">لم يُرفع بعد</span></div><span class="hint">${hint}</span>
      <div class="btn-row"><label class="btn btn-ghost btn-sm" style="cursor:pointer">رفع صورة<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-file></label>
      <button class="btn btn-ghost btn-sm" data-remove ${DATA.assets[k] ? '' : 'disabled'}>إزالة</button></div>
      ${hasPos ? `<div data-pos>${['x', 'y', 'w'].map(a => `<div class="range"><label for="${k}-${a}">${{ x: 'أفقيًا', y: 'رأسيًا', w: 'الحجم' }[a]}</label><input id="${k}-${a}" type="range" min="${a === 'w' ? 3 : 0}" max="${a === 'w' ? 40 : 100}" step="0.5" value="${(LAYOUT[k][a] * 100).toFixed(1)}" data-axis="${a}"><output>${Math.round(LAYOUT[k][a] * 100)}</output></div>`).join('')}</div>` : ''}
      <div class="btn-row hidden" data-pending><button class="btn btn-primary btn-sm" data-approve>اعتماد</button><button class="btn btn-ghost btn-sm" data-cancel>إلغاء</button></div>
    </div>`;
    frame(`<h1>الشهادات</h1>
      <div class="card">
        <h2>معاينة الشهادة</h2>
        <p class="hint">تتحدث المعاينة مباشرة مع تغيير المواضع والأحجام أو رفع صورة جديدة. لا يظهر أي ختم أو توقيع إلا بعد رفعه واعتماده.</p>
        <label class="switch" style="margin-bottom:10px"><input type="checkbox" data-guides checked> إظهار أماكن الختم والتوقيعات</label>
        <canvas class="preview-canvas" data-preview width="1414" height="1000" aria-label="معاينة الشهادة"></canvas>
      </div>
      <div class="card">
        <h2>الختم والتوقيعات والشعار</h2>
        <p class="hint">ارفعي الصور الرسمية فقط (PNG بخلفية شفافة أفضل). كل ملف على حدة، ثم عدّلي الموضع والحجم واضغطي «اعتماد».</p>
        <div class="asset-grid">
          ${assetCard('stamp', 'ختم المدرسة', 'يوضع في وسط أسفل الشهادة.', true)}
          ${assetCard('sigVice', `توقيع ${esc(s.lesson.viceTitle)}`, `قرب اسم ${esc(s.lesson.viceName)}.`, true)}
          ${assetCard('sigPrincipal', `توقيع ${esc(s.lesson.principalTitle)}`, `قرب اسم ${esc(s.lesson.principalName)}.`, true)}
          ${assetCard('logo', 'شعار وزارة التعليم', 'يظهر في ترويسة المنصة ووسط أعلى الشهادة.', false)}
        </div>
      </div>
      <div class="card">
        <h2>نص الشهادة</h2>
        <div class="field"><label for="ctitle">عنوان الشهادة</label><input id="ctitle" type="text" value="${esc(certSet.title)}"></div>
        <div class="field"><label for="cbody">النص (كل سطر في الشهادة سطر هنا)</label><textarea id="cbody" rows="8">${esc(certSet.body)}</textarea>
          <span class="hint">العناصر المتاحة: {الاسم} في سطر مستقل يظهر بحجم بارز، {عنوان_الدرس} في سطر مستقل يظهر بالإنجليزية، {المادة} {الصف} {طريقة_التنفيذ} {التاريخ} {رقم_الشهادة}. تُؤخذ قيمها من «محتوى الدرس». الترويسة وأسماء الموقّعات تُعدّل من «محتوى الدرس».</span></div>
        <div class="field"><label for="cpre">بادئة رقم الشهادة (يظهر الرقم في صفحة الشهادة ولوحة المعلمة فقط)</label><input id="cpre" type="text" dir="ltr" value="${esc(certSet.numberPrefix)}"><input type="checkbox" id="cqr" hidden></div>
        <button class="btn btn-primary" data-savecert>حفظ نص الشهادة</button>
      </div>
      <div class="card">
        <h2>الشهادات الصادرة <small class="muted">(${ar(list.length)})</small></h2>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>الرقم</th><th>الاسم</th><th>الحالة</th><th>الإصدار</th><th>إجراءات</th></tr></thead><tbody>
          ${list.map(p => `<tr><td class="ltr" style="text-align:right">${esc(p.cert.number)}</td><td>${esc(p.name)}</td><td><span class="badge ${p.cert.status === 'active' ? 'ok' : 'bad'}">${p.cert.status === 'active' ? 'معتمدة' : 'ملغاة'}</span></td><td><small>${fmtDate(p.cert.issuedAt)}</small></td>
          <td><div class="li-tools"><a class="icon-btn" href="/c/${esc(p.cert.token)}" target="_blank" rel="noopener" aria-label="معاينة">${ic('ext')}</a><button class="icon-btn" data-dl="${esc(p.id)}" aria-label="تنزيل PDF">${U.icon('download')}</button><button class="icon-btn" data-open-p="${esc(p.id)}" aria-label="إدارة">${ic('edit')}</button></div></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">لم تصدر شهادات بعد.</p>'}
      </div>`);
    const canvas = U.$('[data-preview]');
    let rt = null;
    const preview = () => { clearTimeout(rt); rt = setTimeout(async () => {
      const cs = { ...s, cert: { ...s.cert, title: U.$('#ctitle').value, body: U.$('#cbody').value, numberPrefix: U.$('#cpre').value, showQr: U.$('#cqr').checked } };
      await CertRenderer.render(canvas, certData(null, cs, LAYOUT), await certImgs(true), { scale: 1, guides: U.$('[data-guides]').checked });
    }, 120); };
    preview();
    ['#ctitle', '#cbody', '#cpre', '#cqr', '[data-guides]'].forEach(sel => U.$(sel).addEventListener('input', preview));
    U.$('[data-guides]').addEventListener('change', preview); U.$('#cqr').addEventListener('change', preview);
    U.$('[data-savecert]').addEventListener('click', async () => {
      try { await aapi('/api/admin/settings', { method: 'PUT', body: { settings: { cert: { title: U.$('#ctitle').value, body: U.$('#cbody').value, numberPrefix: U.$('#cpre').value, showQr: U.$('#cqr').checked } } } }); await load(); U.toast('حُفظ نص الشهادة'); } catch (e) { U.toast(e.message); }
    });
    U.$$('[data-asset]').forEach(async box => {
      const k = box.dataset.asset;
      const setThumb = url => { U.$('[data-thumb]', box).innerHTML = url ? `<img src="${url}" alt="">` : '<span class="muted">لم يُرفع بعد</span>'; };
      setThumb(PENDING[k] ? PENDING[k].dataUrl : await assetUrl(k));
      const pend = on => U.$('[data-pending]', box).classList.toggle('hidden', !on);
      pend(!!PENDING[k] || layoutChanged(k));
      U.$('[data-file]', box).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try { PENDING[k] = await readFile(f, true); setThumb(PENDING[k].dataUrl); pend(true); preview(); U.toast('راجعي المعاينة ثم اضغطي «اعتماد»'); } catch (er) { U.toast(er.message); }
      });
      U.$$('[data-axis]', box).forEach(r => r.addEventListener('input', () => {
        LAYOUT[k][r.dataset.axis] = Number(r.value) / 100; r.nextElementSibling.textContent = Math.round(Number(r.value)); pend(true); preview();
      }));
      U.$('[data-cancel]', box).addEventListener('click', () => { delete PENDING[k]; if (LAYOUT[k]) LAYOUT[k] = deep(DATA.settings.certLayout[k]); certs(); });
      U.$('[data-approve]', box).addEventListener('click', async () => {
        try {
          if (PENDING[k]) await aapi('/api/admin/assets/' + k, { method: 'POST', body: { mime: PENDING[k].mime, name: PENDING[k].name, data: PENDING[k].dataUrl.split(',')[1] } });
          if (LAYOUT[k]) await aapi('/api/admin/settings', { method: 'PUT', body: { settings: { certLayout: { [k]: LAYOUT[k] } } } });
          delete PENDING[k]; await load(); LAYOUT = deep(DATA.settings.certLayout); U.toast('تم الاعتماد'); certs();
        } catch (er) { U.toast(er.message); }
      });
      U.$('[data-remove]', box).addEventListener('click', async () => {
        if (!confirm('إزالة هذه الصورة من الشهادات؟')) return;
        await aapi('/api/admin/assets/' + k, { method: 'DELETE' }); delete ASSET_URLS[k]; await load(); certs();
      });
    });
    U.$$('[data-dl]').forEach(b => b.addEventListener('click', () => downloadCert(DATA.participants.find(p => p.id === b.dataset.dl))));
    U.$$('[data-open-p]').forEach(b => b.addEventListener('click', () => drawer(b.dataset.openP)));
  }
  const layoutChanged = k => LAYOUT && LAYOUT[k] && JSON.stringify(LAYOUT[k]) !== JSON.stringify(DATA.settings.certLayout[k]);

  // ---------- محتوى الدرس ----------
  function content() {
    const { esc } = U;
    if (!EDIT) EDIT = { s: deep(DATA.settings), dirty: false };
    const s = EDIT.s;
    const inp = (path, label, opts = {}) => { const v = path.split('.').reduce((o, k) => o[k], s); return `<div class="field"><label for="f-${path}">${label}</label>${opts.area ? `<textarea id="f-${path}" data-bind="${path}" rows="${opts.rows || 3}">${esc(v)}</textarea>` : `<input id="f-${path}" type="text" data-bind="${path}" value="${esc(v)}" ${opts.ltr ? 'dir="ltr"' : ''}>`}</div>`; };
    const tools = (list, i, n) => `<div class="li-tools"><button type="button" class="icon-btn" data-mv="${list}" data-i="${i}" data-d="-1" aria-label="تحريك لأعلى" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button><button type="button" class="icon-btn" data-mv="${list}" data-i="${i}" data-d="1" aria-label="تحريك لأسفل" ${i === n - 1 ? 'disabled' : ''}>${ic('down')}</button><button type="button" class="icon-btn danger" data-rm="${list}" data-i="${i}" aria-label="حذف">${ic('trash')}</button></div>`;
    const L = s.lesson;
    frame(`<h1>محتوى الدرس</h1>
      <p class="hint">التعديلات هنا تظهر في المنصة وفي الشهادات بعد الضغط على «حفظ التعديلات».</p>
      <div class="card"><h2>ترويسة المدرسة</h2>
        <div class="list-editor">${s.header.map((h, i) => `<div class="li-row"><div class="li-fields"><input type="text" data-li="header" data-i="${i}" value="${esc(h)}" aria-label="سطر الترويسة ${i + 1}"></div>${tools('header', i, s.header.length)}</div>`).join('')}</div>
        <button class="btn btn-ghost btn-sm" data-add="header" style="margin-top:10px">${ic('plus')} إضافة سطر</button></div>
      <div class="card"><h2>بيانات الدرس</h2>
        <div class="grid2">${inp('lesson.kind', 'نوع الدرس')}${inp('lesson.title', 'عنوان الدرس (بالإنجليزية)', { ltr: true })}${inp('lesson.course', 'المقرر', { ltr: true })}${inp('lesson.subject', 'المادة')}
        ${inp('lesson.grade', 'الصف')}${inp('lesson.delivery', 'طريقة التنفيذ')}${inp('lesson.date', 'التاريخ (كما يظهر في الشهادة)')}
        ${inp('lesson.teachersTitle', 'مسمى المنفذتين')}${inp('lesson.teachers', 'أسماء المعلمتين المنفذتين')}
        ${inp('lesson.viceTitle', 'مسمى الوكيلة')}${inp('lesson.viceName', 'اسم الوكيلة')}${inp('lesson.principalTitle', 'مسمى المديرة')}${inp('lesson.principalName', 'اسم المديرة')}</div></div>
      <div class="card"><h2>الأهداف</h2>
        <div class="list-editor">${s.objectives.map((o, i) => `<div class="li-row"><div class="li-fields"><input type="text" dir="ltr" data-li="objectives" data-i="${i}" data-k="text" value="${esc(o.text)}" aria-label="الهدف ${i + 1}"></div>${tools('objectives', i, s.objectives.length)}</div>`).join('')}</div>
        <button class="btn btn-ghost btn-sm" data-add="objectives" style="margin-top:10px">${ic('plus')} إضافة هدف</button></div>
      <div class="card"><h2>الاستراتيجيات</h2>
        <div class="list-editor">${s.strategies.map((o, i) => `<div class="li-row"><div class="li-fields"><input type="text" data-li="strategies" data-i="${i}" data-k="title" value="${esc(o.title)}" placeholder="اسم الاستراتيجية" aria-label="اسم الاستراتيجية ${i + 1}"><input type="text" data-li="strategies" data-i="${i}" data-k="desc" value="${esc(o.desc)}" placeholder="وصف مختصر (اختياري)" aria-label="وصف الاستراتيجية ${i + 1}"></div>${tools('strategies', i, s.strategies.length)}</div>`).join('') || '<p class="empty">لم تُضف استراتيجيات بعد.</p>'}</div>
        <button class="btn btn-ghost btn-sm" data-add="strategies" style="margin-top:10px">${ic('plus')} إضافة استراتيجية</button></div>
      <div class="card"><h2>المرفقات</h2>
        <div class="list-editor">${s.attachments.map((a, i) => `<div class="li-row"><div class="li-fields">
          <input type="text" data-li="attachments" data-i="${i}" data-k="title" value="${esc(a.title)}" placeholder="عنوان المرفق" aria-label="عنوان المرفق ${i + 1}">
          ${a.type === 'link' ? `<input type="url" dir="ltr" data-li="attachments" data-i="${i}" data-k="url" value="${esc(a.url)}" placeholder="https://" aria-label="رابط المرفق ${i + 1}">` : `<span class="hint">${U.icon('file')} ملف: ${esc(a.fileName || '')}</span>`}
          <input type="text" data-li="attachments" data-i="${i}" data-k="note" value="${esc(a.note || '')}" placeholder="ملاحظة (اختياري)" aria-label="ملاحظة المرفق ${i + 1}"></div>${tools('attachments', i, s.attachments.length)}</div>`).join('') || '<p class="empty">لا توجد مرفقات.</p>'}</div>
        <div class="btn-row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-add="link">${ic('plus')} إضافة رابط</button>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">${ic('plus')} رفع ملف (حتى ١٦ ميجابايت)<input type="file" hidden data-attfile></label></div>
        <p class="hint">لعرض شرائح كبير يمكن رفعه إلى OneDrive أو Google Drive وإضافة رابطه.</p></div>
      <div class="card"><h2>محاور التقييم</h2><p class="hint">مقياس من ١ (منخفض) إلى ٥ (مرتفع). يمكن تحديد المطلوب والاختياري.</p>
        <div class="list-editor">${s.questions.map((q, i) => `<div class="li-row"><div class="li-fields"><input type="text" data-li="questions" data-i="${i}" data-k="text" value="${esc(q.text)}" aria-label="المحور ${i + 1}">
          <label class="switch"><input type="checkbox" data-li="questions" data-i="${i}" data-k="required" ${q.required ? 'checked' : ''}> مطلوب</label></div>${tools('questions', i, s.questions.length)}</div>`).join('')}</div>
        <button class="btn btn-ghost btn-sm" data-add="questions" style="margin-top:10px">${ic('plus')} إضافة محور</button></div>
      <div class="card"><h2>حقول الرأي</h2>
        ${['comment', 'suggestions'].map(k => `<div class="grid2"><div class="field"><label for="fl-${k}">عنوان الحقل</label><input id="fl-${k}" type="text" data-bind="fields.${k}.label" value="${esc(s.fields[k].label)}"></div>
          <div class="field"><span class="label">الإلزام</span><label class="switch"><input type="checkbox" data-bindc="fields.${k}.required" ${s.fields[k].required ? 'checked' : ''}> مطلوب</label></div></div>`).join('')}</div>
      <div class="card"><h2>نصوص المنصة</h2>
        <div class="grid2">${inp('branding.platformName', 'اسم المنصة')}${inp('branding.homeTagline', 'عبارة الواجهة الرئيسة')}${inp('branding.rateTitle', 'عنوان صفحة التقييم')}${inp('branding.startButton', 'نص زر البدء')}
        ${inp('branding.welcome', 'عبارة الترحيب')}${inp('branding.thanks', 'رسالة الشكر بعد الإرسال')}</div>
        ${inp('branding.homeIntro', 'تعريف المنصة في الرئيسة', { area: true })}${inp('branding.rateIntro', 'نص صفحة التقييم', { area: true })}${inp('branding.closedMessage', 'رسالة إغلاق التقييم', { area: true })}
        <div class="field"><label for="cats">تصنيفات الآراء (مفصولة بفاصلة)</label><input id="cats" type="text" data-cats value="${esc((s.categories || []).join('، '))}"></div></div>
      <div class="save-bar"><button class="btn btn-primary" data-saveall>حفظ التعديلات</button><button class="btn btn-ghost" data-discard>تراجع عن التعديلات</button></div>`);
    const main = U.$('#main');
    const dirty = () => { EDIT.dirty = true; };
    main.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.bind) { const ks = t.dataset.bind.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], s)[last] = t.value; dirty(); }
      if (t.dataset.li) { const arr = s[t.dataset.li]; const i = Number(t.dataset.i); if (t.dataset.li === 'header') arr[i] = t.value; else arr[i][t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value; dirty(); }
      if (t.dataset.bindc) { const ks = t.dataset.bindc.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], s)[last] = t.checked; dirty(); }
      if (t.hasAttribute('data-cats')) { s.categories = t.value.split(/[،,]/).map(x => x.trim()).filter(Boolean); dirty(); }
    });
    main.addEventListener('change', e => { const t = e.target; if (t.type === 'checkbox' && (t.dataset.li || t.dataset.bindc)) t.dispatchEvent(new Event('input', { bubbles: true })); });
    const keep = fn => { const y = window.scrollY; fn(); dirty(); content(); window.scrollTo(0, y); };
    U.$$('[data-mv]').forEach(b => b.addEventListener('click', () => keep(() => { const a = s[b.dataset.mv], i = Number(b.dataset.i), j = i + Number(b.dataset.d); [a[i], a[j]] = [a[j], a[i]]; })));
    U.$$('[data-rm]').forEach(b => b.addEventListener('click', () => {
      const list = b.dataset.rm, i = Number(b.dataset.i);
      if (list === 'questions' && s.questions.length === 1) return U.toast('أبقي محورًا واحدًا على الأقل');
      if (!confirm('حذف هذا العنصر؟')) return;
      keep(() => { s[list].splice(i, 1); });
    }));
    const rid = () => Math.random().toString(36).slice(2, 8);
    U.$$('[data-add]').forEach(b => b.addEventListener('click', () => keep(() => {
      const t = b.dataset.add;
      if (t === 'header') s.header.push('');
      if (t === 'objectives') s.objectives.push({ id: 'o' + rid(), text: '' });
      if (t === 'strategies') s.strategies.push({ id: 's' + rid(), title: '', desc: '' });
      if (t === 'questions') s.questions.push({ id: 'q' + rid(), text: 'محور جديد', required: false });
      if (t === 'link') s.attachments.push({ id: 'a' + rid(), type: 'link', title: '', url: '', note: '' });
    })));
    U.$('[data-attfile]').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 16 * 1024 * 1024) return U.toast('الحد الأقصى ١٦ ميجابايت — أضيفي رابطًا بدلًا من ذلك');
      try {
        U.toast('جارٍ رفع الملف…');
        const r = await readFile(f, false); const key = 'att_' + rid() + rid();
        await aapi('/api/admin/assets/' + key, { method: 'POST', body: { mime: r.mime, name: r.name, data: r.dataUrl.split(',')[1] } });
        keep(() => { s.attachments.push({ id: 'a' + rid(), type: 'file', title: f.name.replace(/\.[^.]+$/, ''), assetKey: key, fileName: f.name, note: '' }); });
        U.toast('رُفع الملف — اضغطي «حفظ التعديلات» لاعتماده');
      } catch (er) { U.toast(er.message); }
    });
    U.$('[data-saveall]').addEventListener('click', async () => {
      const bad = s.attachments.find(a => a.type === 'link' && !/^https?:\/\//i.test(a.url));
      if (bad) return U.toast('تأكدي من أن روابط المرفقات تبدأ بـ https://');
      try { await aapi('/api/admin/settings', { method: 'PUT', body: { settings: s } }); await load(); EDIT = null; content(); U.toast('حُفظت التعديلات وظهرت في المنصة'); } catch (er) { U.toast(er.message); }
    });
    U.$('[data-discard]').addEventListener('click', () => { if (EDIT.dirty && !confirm('التراجع عن كل التعديلات غير المحفوظة؟')) return; EDIT = null; content(); });
  }

  // ---------- التقارير ----------
  function reports() {
    frame(`<h1>التقارير</h1>
      <div class="card"><h2>${ic('report')} ملف Excel</h2><p class="muted">ثلاث أوراق: المشاركات بكل التقييمات والآراء، والنتائج لكل محور، والمراجعة الداخلية (منفصلة عن تقييم الحاضرات).</p>
        <button class="btn btn-primary" data-xlsx>${U.icon('download')} تنزيل Excel</button></div>
      <div class="card"><h2>${U.icon('print')} تقرير PDF للطباعة</h2>
        <p class="muted">تقرير عام بالنتائج والآراء المختارة للعرض دون أسماء ودون الملاحظات الداخلية. اختاري «حفظ بتنسيق PDF» من نافذة الطباعة.</p>
        <label class="switch" style="margin-bottom:12px"><input type="checkbox" data-names> تضمين سجل الحضور (الأسماء وأرقام الشهادات)</label>
        <div><button class="btn btn-lilac" data-pdfrep>${U.icon('print')} إنشاء التقرير</button></div></div>`);
    U.$('[data-xlsx]').addEventListener('click', async () => {
      try { const r = await aapi('/api/admin/export.xlsx', { raw: true }); U.download(await r.blob(), 'أثر-يضيء-التقرير.xlsx'); } catch (e) { U.toast(e.message); }
    });
    U.$('[data-pdfrep]').addEventListener('click', () => U.printHtml(reportHtml(U.$('[data-names]').checked), false, true));
  }
  function reportHtml(withNames) {
    const { esc, ar } = U; const s = DATA.settings, st = DATA.stats, L = s.lesson;
    const ops = DATA.participants.filter(p => p.status === 'completed' && p.review?.featured).map(p => p.review.featuredText || p.comment).filter(Boolean);
    const att = DATA.participants.filter(p => p.status === 'completed' && p.cert).sort((a, b) => a.cert.number.localeCompare(b.cert.number));
    return `<div class="report" dir="rtl">
      <p style="margin:0;color:#555">${s.header.map(esc).join(' · ')}</p>
      <h1>تقرير الدرس التطبيقي: <span class="ltr">${esc(L.title)}</span></h1>
      <p><span class="ltr">${esc(L.course)}</span> — ${esc(L.subject)} — الصف ${esc(L.grade)} — ${esc(L.delivery)} — ${esc(L.date)}</p>
      <p>${esc(L.teachersTitle)}: ${esc(L.teachers)}</p>
      <div class="stats" style="margin:12px 0">
        <div class="stat"><b>${ar(st.registered)}</b><span>المسجلات</span></div><div class="stat"><b>${ar(st.completed)}</b><span>المكتملة</span></div>
        <div class="stat"><b>${ar(st.certsActive)}</b><span>الشهادات المعتمدة</span></div><div class="stat"><b>${fix(st.overallAvg)}</b><span>المتوسط العام من ٥</span></div></div>
      <h2>نتائج المحاور</h2>
      <table><thead><tr><th>المحور</th><th>الإجابات</th><th>المتوسط</th><th>١</th><th>٢</th><th>٣</th><th>٤</th><th>٥</th></tr></thead>
        <tbody>${st.perQ.map(q => `<tr><td>${esc(q.text)}</td><td>${ar(q.count)}</td><td><b>${fix(q.avg)}</b></td>${q.dist.map(n => `<td>${ar(n)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <h2 style="margin-top:16px">من آراء الحاضرات</h2>
      ${ops.length ? ops.map(o => `<blockquote>${esc(o)}</blockquote>`).join('') : '<p>لم تُختر آراء للعرض بعد.</p>'}
      ${withNames ? `<h2 style="margin-top:16px">سجل الحضور</h2><table><thead><tr><th>#</th><th>الاسم</th><th>رقم الشهادة</th><th>الحالة</th></tr></thead><tbody>${att.map((p, i) => `<tr><td>${ar(i + 1)}</td><td>${esc(p.name)}</td><td class="ltr" style="text-align:right">${esc(p.cert.number)}</td><td>${p.cert.status === 'active' ? 'معتمدة' : 'ملغاة'}</td></tr>`).join('')}</tbody></table>` : ''}
      <p style="margin-top:20px;color:#555">${esc(L.viceTitle)}: ${esc(L.viceName)} — ${esc(L.principalTitle)}: ${esc(L.principalName)}</p>
      <p style="color:#888;font-size:9pt">أُنشئ في ${fmtDate(new Date().toISOString())} — ${esc(s.branding.platformName)}</p></div>`;
  }

  // ---------- الروابط ----------
  function links() {
    const { esc } = U; const o = location.origin;
    const items = [['main', 'رابط المنصة الرئيس', o + '/', 'محتوى الدرس وخريطة الأثر وزر التقييم.'],
      ['rate', 'رابط التقييم المباشر «رأيكِ يترك أثرًا»', o + '/rate', 'للإرسال في دردشة Teams ولآخر شريحة في العرض.'],
      ['nfc', 'رابط شريحة NFC (للنشاط الحضوري)', o + '/rate?src=nfc', 'اكتبيه على الشريحة كسجل رابط (URL) عبر تطبيق مثل NFC Tools.']];
    frame(`<h1>الروابط والدخول</h1>
      ${items.map(([k, t, url, hint]) => `<div class="card"><h2>${t}</h2><div class="qr-box"><canvas data-qr="${k}" width="300" height="300" aria-label="رمز QR لـ ${t}"></canvas>
        <div><p class="muted">${hint}</p><div class="link-line"><code>${esc(url)}</code></div>
        <div class="btn-row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-copyl="${esc(url)}">${U.icon('copy')} نسخ الرابط</button><button class="btn btn-ghost btn-sm" data-dlqr="${k}">${U.icon('download')} تنزيل QR</button><a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">${ic('ext')} فتح</a></div></div></div></div>`).join('')}
      <div class="card"><h2>رابط لوحة المعلمة</h2><div class="link-line"><code>${esc(o + '/admin')}</code><button class="btn btn-ghost btn-sm" data-copyl="${esc(o + '/admin')}">${U.icon('copy')} نسخ</button></div>
        <p class="hint">لا تشاركي هذا الرابط مع الحاضرات؛ الدخول برمز المعلمة فقط.</p></div>
      <div class="card"><h2>تغيير رمز الدخول</h2>
        <p class="hint">${DATA.codeFromEnv ? 'الرمز الحالي مضبوط من إعدادات الخادم (ADMIN_CODE). عند تغييره هنا يُحفظ مشفّرًا في قاعدة البيانات ويحل محله.' : 'الرمز محفوظ مشفّرًا في قاعدة البيانات.'} تغيير الرمز يُخرج الجلسات الأخرى.</p>
        <form data-code class="grid2"><div class="field"><label for="c1">الرمز الحالي</label><input id="c1" type="password" dir="ltr" autocomplete="current-password" required></div>
          <div class="field"><label for="c2">الرمز الجديد (٦ خانات على الأقل)</label><input id="c2" type="password" dir="ltr" autocomplete="new-password" minlength="6" required></div>
          <div><button class="btn btn-primary btn-sm" type="submit">تغيير الرمز</button></div></form></div>`);
    items.forEach(([k, , url]) => {
      const c = U.$(`[data-qr="${k}"]`); const q = QR.toCanvas(url, { scale: 10, border: 4, dark: '#14382A' });
      c.width = q.width; c.height = q.height; c.getContext('2d').drawImage(q, 0, 0);
      U.$(`[data-dlqr="${k}"]`).addEventListener('click', () => {
        const big = QR.toCanvas(url, { scale: 24, border: 4, dark: '#000' });
        big.toBlob(b => U.download(b, `QR-${k === 'main' ? 'المنصة' : k === 'rate' ? 'التقييم' : 'NFC'}.png`));
      });
    });
    U.$$('[data-copyl]').forEach(b => b.addEventListener('click', () => U.copy(b.dataset.copyl)));
    U.$('[data-code]').addEventListener('submit', async e => {
      e.preventDefault();
      try { const r = await aapi('/api/admin/code', { method: 'POST', body: { current: U.$('#c1').value, next: U.$('#c2').value } }); TOKEN = r.token; try { sessionStorage.setItem('athar.admin', TOKEN); } catch (er) {} await load(); links(); U.toast('تم تغيير رمز الدخول'); }
      catch (er) { U.toast(er.message); }
    });
  }

  window.AtharAdmin = {
    async start(utils) {
      U = utils;
      document.title = 'لوحة المعلمة · أثرٌ يضيء';
      try { TOKEN = sessionStorage.getItem('athar.admin'); } catch (e) {}
      if (!TOKEN) return loginView();
      try { await load(); draw(); } catch (e) { loginView(); }
    },
  };
})();
