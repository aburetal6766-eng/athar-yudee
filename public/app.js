// «أثرٌ يضيء» — الواجهة العامة: الرئيسة، رحلة التقييم، الشهادة، خريطة الأثر
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ar = n => Number(n).toLocaleString('ar-SA');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('athar.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('athar.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('athar.' + k); } catch (e) {} },
  };
  const memory = {}; // نسخة احتياطية عند تعطّل التخزين المحلي

  const I = {
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6" stroke-dasharray="2 3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

  async function api(path, opts = {}, retries = 0) {
    const o = { headers: { 'Content-Type': 'application/json' }, ...opts };
    if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await fetch(path, o);
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(data.error || 'تعذر الاتصال'), { status: r.status });
        return data;
      } catch (e) {
        const network = !e.status;
        if (network && attempt < retries) { await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
        if (network) e.message = 'تعذر الاتصال بالخادم. تأكدي من الإنترنت ثم أعيدي المحاولة — لن تُكرر مشاركتكِ.';
        throw e;
      }
    }
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('تم النسخ'); } catch (e2) { prompt('انسخي الرابط:', text); } ta.remove(); }
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function printHtml(html, landscape, report) {
    const area = $('#printArea'); area.innerHTML = html;
    let st = $('#pageStyle'); if (!st) { st = document.createElement('style'); st.id = 'pageStyle'; document.head.appendChild(st); }
    st.textContent = `@media print{@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:${landscape ? 0 : '10mm'}}}`;
    document.body.classList.add('printing'); if (report) document.body.classList.add('printing-report');
    const done = () => { document.body.classList.remove('printing', 'printing-report'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    const imgs = $$('img', area);
    Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))).then(() => setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60));
  }

  let CFG = null;
  async function loadConfig(force) { if (!CFG || force) CFG = await api('/api/public/config', {}, 2); return CFG; }

  // ---------- الإطار ----------
  const MARK = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1F4D3A"/><path d="M32 54C24 42 18 36 18 27a14 14 0 0 1 28 0c0 9-6 15-14 27z" fill="#9B7FD1"/><circle cx="32" cy="27" r="6" fill="#FAF6EC"/><path d="M50 12l1.8 4.2 4.2 1.8-4.2 1.8L50 24l-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#C9A54A"/></svg>';
  function shell(content, active) {
    const s = CFG.settings;
    return `
    <div class="gov" role="note"><div class="wrap">${s.header.map(h => `<span>${esc(h)}</span>`).join('')}</div></div>
    <header class="topbar"><div class="wrap">
      <a class="brand" href="/" data-link>${CFG.logo ? `<img src="${esc(CFG.logo)}" alt="شعار وزارة التعليم">` : MARK}
        <span><b>${esc(s.branding.platformName)}</b><small>${esc(s.lesson.kind)} · <span class="ltr">${esc(s.lesson.title)}</span></small></span></a>
      <nav class="nav" aria-label="التنقل الرئيس">
        <a href="/" data-link ${active === 'home' ? 'aria-current="page"' : ''}>محتوى الدرس</a>
        <a href="/rate" data-link ${active === 'rate' ? 'aria-current="page"' : ''}>${esc(s.branding.rateTitle)}</a>
        <a href="/map" data-link ${active === 'map' ? 'aria-current="page"' : ''}>خريطة الأثر</a>
      </nav>
    </div></header>
    <main id="main" tabindex="-1">${content}</main>
    <footer class="footer"><div class="wrap">
      <span>${esc(s.lesson.viceTitle)}: ${esc(s.lesson.viceName)} · ${esc(s.lesson.principalTitle)}: ${esc(s.lesson.principalName)}</span>
      <span>${esc(s.branding.platformName)}</span>
    </div></footer>`;
  }
  const heroArt = () => `<svg viewBox="0 0 420 320" aria-hidden="true">
    <defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#C9A54A" opacity=".35"/></pattern></defs>
    <rect x="20" y="20" width="380" height="280" rx="36" fill="url(#dots)"/>
    <path d="M70 250 C 120 160, 200 260, 250 170 S 330 80, 350 70" fill="none" stroke="#9B7FD1" stroke-width="4" stroke-dasharray="3 12" stroke-linecap="round"/>
    <path d="M338 58l18 10-16 13" fill="none" stroke="#9B7FD1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(70 252)"><path d="M0 0C-14-20-24-30-24-46a24 24 0 0 1 48 0C24-30 14-20 0 0z" fill="#1F4D3A"/><circle cy="-46" r="9" fill="#FAF6EC"/></g>
    <g transform="translate(250 172)"><path d="M0 0C-10-14-17-21-17-32a17 17 0 0 1 34 0C17-21 10-14 0 0z" fill="#5F4392"/><circle cy="-32" r="6" fill="#FAF6EC"/></g>
    <path d="M352 70l3.6 8.4 8.4 3.6-8.4 3.6-3.6 8.4-3.6-8.4-8.4-3.6 8.4-3.6z" fill="#C9A54A"/>
    <path d="M160 92l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#C9A54A"/>
    <path d="M300 250l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z" fill="#C9A54A"/>
    <g fill="#2E6B52" opacity=".35"><path d="M392 286c-20-6-34-22-36-44 18 6 32 22 36 44z"/><path d="M392 286c-4-20 2-40 18-52 2 20-4 38-18 52z"/></g>
    <g fill="#2E6B52" opacity=".3"><path d="M28 40c20 4 34 18 38 38-20-4-34-18-38-38z"/></g>
  </svg>`;

  // ---------- الرئيسة ----------
  function lessonSections() {
    const s = CFG.settings, L = s.lesson;
    return `
    <section class="section card lesson-card" aria-labelledby="lessonH">
      <span class="eyebrow">${icon('pin')} ${esc(L.kind)}</span>
      <h2 id="lessonH" class="lesson-title ltr">${esc(L.title)}</h2>
      <div class="lesson-course ltr">${esc(L.course)}</div>
      <dl class="facts">
        <div class="fact"><dt>المادة</dt><dd>${esc(L.subject)}</dd></div>
        <div class="fact"><dt>الصف</dt><dd>${esc(L.grade)}</dd></div>
        <div class="fact"><dt>طريقة التنفيذ</dt><dd>${esc(L.delivery)}</dd></div>
        <div class="fact"><dt>التاريخ</dt><dd>${esc(L.date)}</dd></div>
        <div class="fact"><dt>${esc(L.teachersTitle)}</dt><dd>${esc(L.teachers)}</dd></div>
      </dl>
    </section>
    <section class="section card" aria-labelledby="objH">
      <div class="section-title">${icon('target')}<h2 id="objH">أهداف الدرس</h2></div>
      <ul class="objectives">${s.objectives.map(o => `<li class="ltr">${icon('arrow')}<span>${esc(o.text)}</span></li>`).join('')}</ul>
    </section>
    <section class="section card" aria-labelledby="strH">
      <div class="section-title">${icon('route')}<h2 id="strH">استراتيجيات الدرس</h2></div>
      ${s.strategies.length ? `<ol class="strategies">${s.strategies.map(x => `<li><div><b>${esc(x.title)}</b>${x.desc ? `<span class="muted">${esc(x.desc)}</span>` : ''}</div></li>`).join('')}</ol>`
        : '<p class="empty">تُعرض الاستراتيجيات هنا بعد اعتمادها.</p>'}
    </section>
    <section class="section card" aria-labelledby="attH">
      <div class="section-title">${icon('file')}<h2 id="attH">المرفقات المعتمدة</h2></div>
      ${s.attachments.length ? `<div class="attach">${s.attachments.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${icon(a.type === 'link' ? 'link' : 'file')}<span><b>${esc(a.title)}</b>${a.note ? `<br><small class="muted">${esc(a.note)}</small>` : ''}</span></a>`).join('')}</div>`
        : '<p class="empty">تُعرض المرفقات (عرض الشرائح والملفات والروابط) هنا بعد اعتمادها.</p>'}
    </section>`;
  }
  function mapSection() {
    return `<section class="section card" aria-labelledby="mapH">
      <div class="map-card">
        <div>
          <div class="section-title">${icon('map')}<h2 id="mapH">خريطة الأثر</h2></div>
          <div class="counter" data-stars>${ar(CFG.stars)}</div>
          <p class="counter-label">نجمة أضاءت حتى الآن — نجمة لكل مشاركة مكتملة</p>
          <p class="hint">النجوم رمزية، لا تظهر فيها أسماء الحاضرات ولا مواقعهن ولا تقييماتهن.</p>
          <button class="btn btn-ghost btn-sm" data-full>${icon('expand')} عرض بملء الشاشة</button>
        </div>
        <div class="map" data-map></div>
      </div>
    </section>`;
  }
  function home() {
    const s = CFG.settings, B = s.branding;
    const html = `
      <section class="hero"><div class="wrap hero-grid">
        <div>
          <span class="eyebrow">${icon('star')} ${esc(B.platformName)}</span>
          <h1>${esc(B.homeTagline)}</h1>
          <p class="tagline ltr" style="text-align:right">${esc(s.lesson.title)}</p>
          <p class="lead">${esc(B.homeIntro)}</p>
          <div class="btn-row">
            ${CFG.open ? `<a class="btn btn-primary" href="/rate" data-link>${esc(B.startButton)} ${icon('arrowL')}</a>` : `<span class="notice">${esc(B.closedMessage)}</span>`}
            <a class="btn btn-ghost" href="#mapH">${icon('map')} خريطة الأثر</a>
          </div>
        </div>
        <div class="hero-art">${heroArt()}</div>
      </div></section>
      <div class="wrap">
        ${lessonSections()}
        ${CFG.open ? `<section class="section cta-band"><div><h2>${esc(B.rateTitle)}</h2><p>${esc(B.rateIntro)}</p></div><a class="btn btn-primary" href="/rate" data-link>${esc(B.startButton)} ${icon('arrowL')}</a></section>` : ''}
        ${mapSection()}
        ${CFG.opinions.length ? `<section class="section" aria-labelledby="opH"><div class="section-title">${icon('quote')}<h2 id="opH">من أثر الحاضرات</h2></div>
          <div class="opinions">${CFG.opinions.map(o => `<blockquote>${esc(o.text)}</blockquote>`).join('')}</div></section>` : ''}
      </div>`;
    render(shell(html, 'home'));
    mountMap();
  }
  let pollTimer = null;
  function mountMap() {
    const m = $('[data-map]'); if (!m) return;
    AtharMap.render(m, CFG.stars);
    $('[data-full]') && $('[data-full]').addEventListener('click', openFullMap);
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const st = await api('/api/public/stats');
        if (st.stars !== CFG.stars) { CFG.stars = st.stars; $$('[data-stars]').forEach(e => e.textContent = ar(st.stars)); $$('[data-map]').forEach(e => AtharMap.render(e, st.stars)); }
      } catch (e) {}
    }, 8000);
  }
  function openFullMap() {
    const box = document.createElement('div');
    box.className = 'map-full'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'خريطة الأثر بملء الشاشة');
    box.innerHTML = `<div class="map-full-head"><div><h2 style="margin:0">خريطة الأثر</h2><span class="counter" style="font-size:2.4rem" data-stars>${ar(CFG.stars)}</span> <span class="counter-label">نجمة</span></div>
      <button class="btn btn-ghost btn-sm" data-close>${icon('close')} إغلاق</button></div><div class="map" data-map></div>`;
    document.body.appendChild(box);
    AtharMap.render($('[data-map]', box), CFG.stars);
    const close = () => { box.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('[data-close]', box).addEventListener('click', close);
    $('[data-close]', box).focus();
    if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
  }
  function mapPage() {
    const html = `<div class="wrap">${mapSection()}</div>`;
    render(shell(html, 'map'));
    mountMap();
  }

  // ---------- رحلة التقييم ----------
  const STEPS = ['الاسم', 'التقييم', 'رأيكِ', 'المراجعة', 'الشهادة'];
  function pid() {
    let id = store.get('pid', null) || memory.pid;
    if (!id) {
      const b = new Uint8Array(12); crypto.getRandomValues(b);
      id = 'p' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      store.set('pid', id); memory.pid = id;
    }
    return id;
  }
  function draft() { return memory.draft || (memory.draft = store.get('draft', { step: 0, name: '', ratings: {}, comment: '', suggestions: '' })); }
  function saveDraft() { store.set('draft', memory.draft); }
  const src = () => new URLSearchParams(location.search).get('src') || '';

  async function ratePage() {
    const B = CFG.settings.branding;
    const prevCert = store.get('certToken', null);
    // هل سبق الإرسال من هذا الجهاز؟
    if (prevCert) {
      try {
        await api('/api/cert/' + prevCert);
        return render(shell(`<div class="wrap flow"><div class="card intro-card">
          <h1>${esc(B.thanks)}</h1><p>سبق أن أرسلتِ تقييمكِ من هذا الجهاز، وشهادتكِ جاهزة.</p>
          <div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="/c/${esc(prevCert)}" data-link>${icon('eye')} عرض شهادتي</a>
          <a class="btn btn-ghost" href="/" data-link>${icon('book')} محتوى الدرس</a></div>
          <p class="hint" style="margin-top:16px">تشاركين الجهاز مع زميلة؟ <button class="btn btn-ghost btn-sm" data-new>بدء مشاركة جديدة على هذا الجهاز</button></p></div></div>`, 'rate'), () => {
          $('[data-new]').addEventListener('click', () => { store.del('pid'); store.del('draft'); store.del('certToken'); memory.pid = null; memory.draft = null; ratePage(); });
        });
      } catch (e) { if (e.status === 404) store.del('certToken'); }
    }
    let d = draft();
    if (d.step >= 5) { // مشاركة سابقة حُذفت: نبدأ من جديد
      store.del('pid'); store.del('draft'); memory.pid = null; memory.draft = null; d = draft();
    }
    if (!CFG.open) {
      return render(shell(`<div class="wrap flow"><div class="card intro-card"><h1>${esc(B.rateTitle)}</h1><p>${esc(B.closedMessage)}</p>
        <a class="btn btn-primary" href="/" data-link>${icon('book')} محتوى الدرس</a></div></div>`, 'rate'));
    }
    drawStep();
  }

  function stepper(cur) {
    return `<ol class="stepper" aria-label="خطوات التقييم">${STEPS.map((s, i) => `<li class="${i + 1 < cur ? 'done' : i + 1 === cur ? 'current' : ''}" ${i + 1 === cur ? 'aria-current="step"' : ''}>${s}</li>`).join('')}</ol>
      <p class="step-meta">الخطوة ${ar(cur)} من ${ar(STEPS.length)}</p>`;
  }
  function drawStep(errMsg) {
    const d = draft(), s = CFG.settings, B = s.branding;
    let body = '';
    if (d.step === 0) {
      body = `<div class="card intro-card">
        <svg class="intro-art" viewBox="0 0 140 110" aria-hidden="true"><path d="M20 90 C 50 40, 80 100, 118 30" fill="none" stroke="#9B7FD1" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/><g transform="translate(20 92)"><path d="M0 0C-9-13-15-19-15-29a15 15 0 0 1 30 0C15-19 9-13 0 0z" fill="#1F4D3A"/><circle cy="-29" r="5.5" fill="#FAF6EC"/></g><path d="M120 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#C9A54A"/></svg>
        <h1>${esc(B.rateTitle)}</h1>
        <p>${esc(B.rateIntro)}</p>
        <div class="btn-row" style="justify-content:center"><button class="btn btn-primary" data-start>${esc(B.startButton)} ${icon('arrowL')}</button>
        <a class="btn btn-ghost" href="/" data-link>${icon('book')} الاطلاع على محتوى الدرس</a></div></div>`;
    } else if (d.step === 1) {
      body = `${stepper(1)}<form class="card" data-form novalidate>
        <h1 style="font-size:1.8rem">${esc(B.welcome)}</h1>
        <p class="muted">اكتبي اسمكِ الكامل كما ترغبين في ظهوره على شهادة الحضور.</p>
        ${errMsg ? `<p class="error" role="alert">${esc(errMsg)}</p>` : ''}
        <div class="field"><label for="nm">الاسم الكامل <span class="req" aria-hidden="true">*</span></label>
          <input id="nm" type="text" autocomplete="name" required minlength="3" maxlength="120" value="${esc(d.name)}" placeholder="مثال: نورة بنت محمد العتيبي">
          <span class="hint">سيظهر الاسم على الشهادة كما تكتبينه، ويمكنكِ مراجعته قبل الإرسال.</span></div>
        <div class="flow-actions"><button class="btn btn-primary" type="submit">التالي ${icon('arrowL')}</button></div>
        <p class="hint" style="margin-top:10px"><a href="/" data-link>الاطلاع على محتوى الدرس</a> — تبقى إدخالاتكِ محفوظة.</p>
      </form>`;
    } else if (d.step === 2) {
      body = `${stepper(2)}<form class="card" data-form novalidate>
        <h2>قيّمي الدرس</h2>
        <div class="scale-legend"><span>١ = منخفض</span><span>٥ = مرتفع</span></div>
        ${errMsg ? `<p class="error" role="alert">${esc(errMsg)}</p>` : ''}
        ${s.questions.map(q => `<div class="rate-item"><fieldset>
          <legend>${esc(q.text)} ${q.required ? '<span class="req" aria-label="مطلوب">*</span>' : '<span class="opt">(اختياري)</span>'}</legend>
          <div class="scale">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${esc(q.id)}" value="${n}" ${d.ratings[q.id] === n ? 'checked' : ''} aria-label="${ar(n)} من ٥${n === 1 ? ' — منخفض' : n === 5 ? ' — مرتفع' : ''}"><span>${ar(n)}</span></label>`).join('')}</div>
          <div class="scale-ends"><span>منخفض</span><span>مرتفع</span></div>
        </fieldset></div>`).join('')}
        <div class="flow-actions"><button class="btn btn-ghost" type="button" data-back>${icon('arrow')} السابق</button><button class="btn btn-primary" type="submit">التالي ${icon('arrowL')}</button></div>
      </form>`;
    } else if (d.step === 3) {
      const F = s.fields;
      body = `${stepper(3)}<form class="card" data-form novalidate>
        <h2>شاركينا رأيكِ</h2>
        ${errMsg ? `<p class="error" role="alert">${esc(errMsg)}</p>` : ''}
        <div class="field"><label for="cm">${esc(F.comment.label)} ${F.comment.required ? '<span class="req" aria-hidden="true">*</span>' : '<span class="opt">(اختياري)</span>'}</label>
          <textarea id="cm" maxlength="4000">${esc(d.comment)}</textarea></div>
        <div class="field"><label for="sg">${esc(F.suggestions.label)} ${F.suggestions.required ? '<span class="req" aria-hidden="true">*</span>' : '<span class="opt">(اختياري)</span>'}</label>
          <textarea id="sg" maxlength="4000">${esc(d.suggestions)}</textarea></div>
        <p class="hint">رأيكِ خاص ويصل إلى المعلمتين فقط.</p>
        <div class="flow-actions"><button class="btn btn-ghost" type="button" data-back>${icon('arrow')} السابق</button><button class="btn btn-primary" type="submit">التالي ${icon('arrowL')}</button></div>
      </form>`;
    } else if (d.step === 4) {
      const answered = s.questions.filter(q => d.ratings[q.id]);
      body = `${stepper(4)}<form class="card" data-form novalidate>
        <h2>راجعي اسمكِ قبل الإرسال</h2>
        <div class="name-preview"><div class="on">سيظهر اسمكِ على الشهادة هكذا</div><div class="nm" data-nmprev>${esc(d.name)}</div></div>
        ${errMsg ? `<p class="error" role="alert">${esc(errMsg)}</p>` : ''}
        <div class="field"><label for="nm2">تصحيح الاسم (عند الحاجة)</label><input id="nm2" type="text" value="${esc(d.name)}" maxlength="120" autocomplete="name"></div>
        <details><summary style="cursor:pointer;font-weight:700">ملخص تقييمكِ (${ar(answered.length)} من ${ar(s.questions.length)})</summary>
          <ul class="summary">${s.questions.map(q => `<li><span>${esc(q.text)}</span><b>${d.ratings[q.id] ? ar(d.ratings[q.id]) + ' / ٥' : '—'}</b></li>`).join('')}</ul>
        </details>
        <div class="flow-actions"><button class="btn btn-ghost" type="button" data-back>${icon('arrow')} السابق</button>
          <button class="btn btn-primary" type="submit" data-submit>${icon('check')} تأكيد وإرسال</button></div>
      </form>`;
    }
    render(shell(`<div class="wrap flow">${body}</div>`, 'rate'), () => {
      const f = $('[data-form]');
      $('[data-start]') && $('[data-start]').addEventListener('click', () => { d.step = 1; saveDraft(); drawStep(); });
      $('[data-back]') && $('[data-back]').addEventListener('click', () => { collect(); d.step--; saveDraft(); drawStep(); });
      if (f) {
        f.addEventListener('input', () => { collect(); saveDraft(); const p = $('[data-nmprev]'); if (p) p.textContent = d.name; });
        f.addEventListener('change', () => { collect(); saveDraft(); });
        f.addEventListener('submit', e => { e.preventDefault(); next(); });
        const first = $('input,textarea', f); if (first && d.step === 1) first.focus();
      }
      if (errMsg) { const er = $('.error'); er && er.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
  }
  function collect() {
    const d = draft();
    if (d.step === 1 && $('#nm')) d.name = $('#nm').value.replace(/\s+/g, ' ').trimStart();
    if (d.step === 2) CFG.settings.questions.forEach(q => { const c = $(`input[name="${CSS.escape(q.id)}"]:checked`); if (c) d.ratings[q.id] = Number(c.value); });
    if (d.step === 3) { d.comment = $('#cm').value; d.suggestions = $('#sg').value; }
    if (d.step === 4 && $('#nm2')) d.name = $('#nm2').value.replace(/\s+/g, ' ').trimStart();
  }
  let submitting = false;
  async function next() {
    collect();
    const d = draft(), s = CFG.settings;
    if (d.step === 1) {
      const name = d.name.trim();
      if (name.length < 3) return drawStep('اكتبي الاسم الكامل كما ترغبين في ظهوره على الشهادة.');
      if (name.split(' ').length < 2) { if (!confirm('يبدو أن الاسم من كلمة واحدة. هل هذا هو الاسم الذي ترغبين في ظهوره على الشهادة؟')) return; }
      const btn = $('button[type=submit]'); btn.disabled = true;
      try {
        const r = await api('/api/register', { method: 'POST', body: { id: pid(), name, src: src() } }, 2);
        if (r.status === 'completed' && r.certToken) { store.set('certToken', r.certToken); return go('/c/' + r.certToken); }
      } catch (e) { btn.disabled = false; return drawStep(e.message); }
      d.step = 2; saveDraft(); return drawStep();
    }
    if (d.step === 2) {
      const miss = s.questions.filter(q => q.required && !d.ratings[q.id]);
      if (miss.length) return drawStep('اختاري تقييمًا لكل محور مطلوب: ' + miss.map(q => q.text).join('، '));
      d.step = 3; saveDraft(); return drawStep();
    }
    if (d.step === 3) {
      if (s.fields.comment.required && !d.comment.trim()) return drawStep(`اكتبي ${s.fields.comment.label}.`);
      if (s.fields.suggestions.required && !d.suggestions.trim()) return drawStep(`اكتبي ${s.fields.suggestions.label}.`);
      d.step = 4; saveDraft(); return drawStep();
    }
    if (d.step === 4) {
      if (submitting) return;
      const name = d.name.trim();
      if (name.length < 3) return drawStep('اكتبي الاسم الكامل كما ترغبين في ظهوره على الشهادة.');
      submitting = true;
      const btn = $('[data-submit]'); btn.disabled = true; btn.innerHTML = 'جارٍ الإرسال…';
      try {
        // المعرّف نفسه في كل محاولة: إعادة الإرسال لا تُصدر شهادة ولا نجمة إضافية
        const r = await api('/api/submit', { method: 'POST', body: { id: pid(), name, ratings: d.ratings, comment: d.comment, suggestions: d.suggestions, src: src() } }, 3);
        store.set('certToken', r.certToken);
        d.step = 5; saveDraft();
        submitting = false;
        go('/c/' + r.certToken + '?new=1');
      } catch (e) { submitting = false; drawStep(e.message); }
    }
  }

  // ---------- صفحة الشهادة ----------
  async function certPage(token) {
    render(shell('<div class="wrap"><div class="spinner" role="progressbar" aria-label="جارٍ التحميل"></div></div>', ''));
    let c;
    try { c = await api('/api/cert/' + token, {}, 2); }
    catch (e) { return render(shell(`<div class="wrap flow"><div class="card intro-card"><h1>الشهادة غير متاحة</h1><p>${esc(e.message)}</p><a class="btn btn-primary" href="/" data-link>الصفحة الرئيسة</a></div></div>`, '')); }
    const isNew = new URLSearchParams(location.search).get('new') === '1';
    if (isNew) await loadConfig(true).catch(() => {});
    const B = CFG.settings.branding;
    const link = location.origin + '/c/' + token;
    const revoked = c.status === 'revoked';
    render(shell(`<div class="wrap" style="max-width:980px">
      ${isNew ? `<div class="thanks">${stepper(5)}<h1>${esc(B.thanks)}</h1><p class="muted">أُضيفت نجمتكِ إلى خريطة الأثر، وهذه شهادة حضوركِ.</p></div>` : `<div class="thanks"><h1>شهادة حضور</h1></div>`}
      ${revoked ? '<p class="error" role="alert">هذه الشهادة ملغاة. للاستفسار تواصلي مع المعلمتين المنفذتين.</p>' : ''}
      <div class="cert-meta"><span>رقم الشهادة: <b class="ltr">${esc(c.number)}</b></span><span class="badge ${revoked ? 'bad' : 'ok'}">${revoked ? 'ملغاة' : 'معتمدة'}</span></div>
      <div class="cert-frame" data-view role="button" tabindex="0" aria-label="عرض الشهادة بحجم كامل"><div class="spinner"></div></div>
      <div class="cert-actions">
        <button class="btn btn-primary" data-act="view">${icon('eye')} عرض الشهادة</button>
        <button class="btn btn-lilac" data-act="pdf" ${revoked ? 'disabled' : ''}>${icon('download')} تنزيل PDF</button>
        <button class="btn btn-ghost" data-act="print" ${revoked ? 'disabled' : ''}>${icon('print')} طباعة الشهادة</button>
        <button class="btn btn-ghost" data-act="copy">${icon('copy')} نسخ رابط شهادتي</button>
      </div>
      <p class="hint center">احتفظي برابط شهادتكِ للرجوع إليها في أي وقت: <span class="ltr">${esc(link)}</span></p>
      ${isNew ? mapSection() : ''}
    </div>`, ''), async () => {
      const canvas = document.createElement('canvas');
      await CertRenderer.render(canvas, { ...c, verifyUrl: link }, c.assets);
      const url = canvas.toDataURL('image/png');
      $('[data-view]').innerHTML = `<img src="${url}" alt="شهادة حضور باسم ${esc(c.name)}">`;
      const view = () => {
        const v = document.createElement('div'); v.className = 'viewer'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'الشهادة');
        v.innerHTML = `<img src="${url}" alt="شهادة حضور باسم ${esc(c.name)}"><button class="btn btn-ghost btn-sm">${icon('close')} إغلاق</button>`;
        document.body.appendChild(v); const b = $('button', v); b.focus();
        const close = () => v.remove(); b.addEventListener('click', close); v.addEventListener('click', e => { if (e.target === v) close(); });
        v.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
      };
      $('[data-view]').addEventListener('click', view);
      $('[data-view]').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view(); } });
      $$('[data-act]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'view') view();
        if (a === 'pdf') download(CertRenderer.canvasToPdf(canvas), `شهادة-حضور-${c.name.replace(/\s+/g, '-')}.pdf`);
        if (a === 'print') printHtml(`<img src="${url}" alt="">`, true);
        if (a === 'copy') copy(link);
      }));
      if (isNew) mountMap();
    });
  }

  // ---------- التوجيه ----------
  function render(html, after) {
    clearInterval(pollTimer);
    $('#app').innerHTML = html;
    if (after) after();
  }
  function go(path) { history.pushState({}, '', path); route(); window.scrollTo(0, 0); }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-link]');
    if (a && !e.metaKey && !e.ctrlKey && a.origin === location.origin) { e.preventDefault(); go(a.getAttribute('href')); }
  });
  window.addEventListener('popstate', route);

  async function route() {
    const p = location.pathname.replace(/\/+$/, '') || '/';
    if (p === '/admin') {
      if (!window.AtharAdmin) { const s = document.createElement('script'); s.src = '/admin.js'; s.onload = () => window.AtharAdmin.start({ api, esc, icon, toast, copy, download, printHtml, $, $$, ar }); document.body.appendChild(s); }
      else window.AtharAdmin.start({ api, esc, icon, toast, copy, download, printHtml, $, $$, ar });
      return;
    }
    try { await loadConfig(); }
    catch (e) { $('#app').innerHTML = `<div class="wrap flow"><div class="card intro-card"><h1>تعذر تحميل المنصة</h1><p>${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button></div></div>`; return; }
    document.title = CFG.settings.branding.platformName;
    if (p === '/' || p === '/lesson') return home();
    if (p === '/rate') { document.title = CFG.settings.branding.rateTitle + ' · ' + CFG.settings.branding.platformName; return ratePage(); }
    if (p === '/map') return mapPage();
    const m = p.match(/^\/c\/([A-Za-z0-9_-]+)$/);
    if (m) return certPage(m[1]);
    render(shell('<div class="wrap flow"><div class="card intro-card"><h1>الصفحة غير موجودة</h1><a class="btn btn-primary" href="/" data-link>الرئيسة</a></div></div>', ''));
  }
  window.Athar = { api, esc, icon };
  route();
})();
