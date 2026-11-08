'use strict';
// طبقة التخزين: تحمل كل البيانات في الذاكرة وتكتبها فورًا إلى المخزن الدائم.
// - إذا وُجد DATABASE_URL تُستخدم PostgreSQL (مشتركة بين كل الأجهزة، مناسبة لـ Render/Neon/Supabase).
// - وإلا يُستخدم ملف JSON داخل DATA_DIR (للتجربة المحلية أو لخادم بقرص دائم).
const fs = require('fs');
const path = require('path');

class FileDriver {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    this.file = path.join(dir, 'data.json');
    this.name = 'file:' + dir;
  }
  async init() {}
  async loadAll() {
    if (!fs.existsSync(this.file)) return { kv: {}, participants: [] };
    return JSON.parse(fs.readFileSync(this.file, 'utf8'));
  }
  async _flush(state) {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, this.file);
  }
  async saveKV(state) { await this._flush(state); }
  async saveParticipant(state) { await this._flush(state); }
  async deleteParticipant(state) { await this._flush(state); }
  _assetPath(key) { return path.join(this.dir, 'assets', key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'); }
  async putAsset(key, asset) { fs.writeFileSync(this._assetPath(key), JSON.stringify(asset)); }
  async getAsset(key) {
    const p = this._assetPath(key);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  async deleteAsset(key) { const p = this._assetPath(key); if (fs.existsSync(p)) fs.unlinkSync(p); }
}

class PgDriver {
  constructor(url) {
    let pg;
    try { pg = require('pg'); } catch (e) {
      throw new Error('DATABASE_URL موجود لكن حزمة pg غير مثبتة. شغّلي npm install');
    }
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new pg.Pool({
      connectionString: url,
      ssl: local || process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
      max: 4,
    });
    this.name = 'postgres';
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS athar_kv (k TEXT PRIMARY KEY, v JSONB NOT NULL)`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS athar_participants (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS athar_assets (k TEXT PRIMARY KEY, mime TEXT NOT NULL, name TEXT, data BYTEA NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`);
  }
  async loadAll() {
    const kv = {};
    const r1 = await this.pool.query('SELECT k, v FROM athar_kv');
    for (const row of r1.rows) kv[row.k] = row.v;
    const r2 = await this.pool.query('SELECT data FROM athar_participants');
    return { kv, participants: r2.rows.map(r => r.data) };
  }
  async saveKV(state, key) {
    const keys = key ? [key] : Object.keys(state.kv);
    for (const k of keys) {
      await this.pool.query('INSERT INTO athar_kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v', [k, JSON.stringify(state.kv[k])]);
    }
  }
  async saveParticipant(state, p) {
    await this.pool.query('INSERT INTO athar_participants (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [p.id, JSON.stringify(p)]);
  }
  async deleteParticipant(state, id) { await this.pool.query('DELETE FROM athar_participants WHERE id = $1', [id]); }
  async putAsset(key, asset) {
    await this.pool.query('INSERT INTO athar_assets (k, mime, name, data) VALUES ($1,$2,$3,$4) ON CONFLICT (k) DO UPDATE SET mime=EXCLUDED.mime, name=EXCLUDED.name, data=EXCLUDED.data, updated_at=now()',
      [key, asset.mime, asset.name || null, Buffer.from(asset.data, 'base64')]);
  }
  async getAsset(key) {
    const r = await this.pool.query('SELECT mime, name, data FROM athar_assets WHERE k = $1', [key]);
    if (!r.rows.length) return null;
    return { mime: r.rows[0].mime, name: r.rows[0].name, data: r.rows[0].data.toString('base64') };
  }
  async deleteAsset(key) { await this.pool.query('DELETE FROM athar_assets WHERE k = $1', [key]); }
}

class Store {
  constructor() {
    this.driver = process.env.DATABASE_URL
      ? new PgDriver(process.env.DATABASE_URL)
      : new FileDriver(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
    this.state = { kv: {}, participants: [] };
    this._lock = Promise.resolve();
    this.assetCache = new Map();
  }
  async init() {
    await this.driver.init();
    const loaded = await this.driver.loadAll();
    this.state.kv = loaded.kv || {};
    this.state.participants = loaded.participants || [];
  }
  // تسلسل عمليات الكتابة حتى لا تتداخل (يمنع ازدواج الشهادات عند الضغط المكرر)
  exclusive(fn) {
    const run = this._lock.then(fn, fn);
    this._lock = run.catch(() => {});
    return run;
  }
  get(k, def) { return k in this.state.kv ? this.state.kv[k] : def; }
  async set(k, v) { this.state.kv[k] = v; await this.driver.saveKV(this.state, k); }
  participants() { return this.state.participants; }
  findParticipant(id) { return this.state.participants.find(p => p.id === id); }
  findByToken(t) { return this.state.participants.find(p => p.cert && p.cert.token === t); }
  async saveParticipant(p) {
    p.updatedAt = new Date().toISOString();
    const i = this.state.participants.findIndex(x => x.id === p.id);
    if (i === -1) this.state.participants.push(p); else this.state.participants[i] = p;
    await this.driver.saveParticipant(this.state, p);
  }
  async deleteParticipant(id) {
    this.state.participants = this.state.participants.filter(p => p.id !== id);
    await this.driver.deleteParticipant(this.state, id);
  }
  async putAsset(key, asset) { this.assetCache.delete(key); await this.driver.putAsset(key, asset); }
  async getAsset(key) {
    if (this.assetCache.has(key)) return this.assetCache.get(key);
    const a = await this.driver.getAsset(key);
    if (a && a.data.length < 3_000_000) this.assetCache.set(key, a);
    return a;
  }
  async deleteAsset(key) { this.assetCache.delete(key); await this.driver.deleteAsset(key); }
}

module.exports = { Store };
