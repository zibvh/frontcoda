const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const db = require('../db');

// ── Multer: APK + image uploads ─────────────────

const apkStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/apps')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuid() + ext);
  }
});

const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/imgs')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuid() + ext);
  }
});

const uploadApk = multer({ storage: apkStorage });
const uploadImgs = multer({ storage: imgStorage });

// mixed: icon + banner + screenshots + apk in one form
const uploadAll = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'apk') {
        cb(null, path.join(__dirname, '../public/apps'));
      } else {
        cb(null, path.join(__dirname, '../public/imgs'));
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, uuid() + ext);
    }
  })
});

// ── Helpers ──────────────────────────────────────

function deleteFile(urlPath) {
  if (!urlPath || urlPath.startsWith('http')) return;
  try {
    const abs = path.join(__dirname, '../public', urlPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
}

// ── GET all apps ─────────────────────────────────
router.get('/', (req, res) => {
  const apps = db.read().map(a => ({
    id: a.id,
    name: a.name,
    tagline: a.tagline,
    category: a.category,
    platform: a.platform,
    version: a.version,
    rating: a.rating,
    downloads: a.downloads,
    icon: a.icon,
    order: a.order
  }));
  res.json(apps);
});

// ── GET single app ───────────────────────────────
router.get('/:id', (req, res) => {
  const app = db.read().find(a => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });
  res.json(app);
});

// ── POST create app ──────────────────────────────
router.post('/', uploadAll.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'screenshots', maxCount: 10 },
  { name: 'apk', maxCount: 1 }
]), (req, res) => {
  try {
    const b = req.body;
    const files = req.files || {};

    const app = {
      id: uuid(),
      name: b.name || 'Untitled',
      tagline: b.tagline || '',
      about: b.about || '',
      category: b.category || '',
      platform: b.platform || '',
      version: b.version || '1.0.0',
      size: b.size || '',
      rating: parseFloat(b.rating) || 0,
      downloads: b.downloads || '',
      order: parseInt(b.order) || 0,
      icon: files.icon ? '/imgs/' + files.icon[0].filename : '',
      banner: files.banner ? '/imgs/' + files.banner[0].filename : '',
      screenshots: (files.screenshots || []).map(f => '/imgs/' + f.filename),
      apk: files.apk ? '/apps/' + files.apk[0].filename : '',
      features: parseJSON(b.features, []),
      updates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const apps = db.read();
    apps.push(app);
    db.write(apps);
    res.status(201).json(app);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── PUT update app ───────────────────────────────
router.put('/:id', uploadAll.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'screenshots', maxCount: 10 },
  { name: 'apk', maxCount: 1 }
]), (req, res) => {
  try {
    const apps = db.read();
    const idx = apps.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const app = apps[idx];
    const b = req.body;
    const files = req.files || {};

    // text fields
    const textFields = ['name','tagline','about','category','platform','version','size','rating','downloads','order'];
    textFields.forEach(k => { if (b[k] !== undefined) app[k] = b[k]; });
    app.rating = parseFloat(app.rating) || 0;
    app.order = parseInt(app.order) || 0;

    // replace files only if new ones uploaded
    if (files.icon) {
      deleteFile(app.icon);
      app.icon = '/imgs/' + files.icon[0].filename;
    }
    if (files.banner) {
      deleteFile(app.banner);
      app.banner = '/imgs/' + files.banner[0].filename;
    }
    // screenshots: merge existing kept URLs + newly uploaded files
    const existingKept = parseJSON(b.existingScreenshots, null);
    if (existingKept !== null) {
      // delete any old screenshots that were removed
      (app.screenshots || []).forEach(s => {
        if (!existingKept.includes(s)) deleteFile(s);
      });
      const newUploads = (files.screenshots || []).map(f => '/imgs/' + f.filename);
      app.screenshots = [...existingKept, ...newUploads];
    } else if (files.screenshots && files.screenshots.length) {
      app.screenshots = [...(app.screenshots || []), ...files.screenshots.map(f => '/imgs/' + f.filename)];
    }
    if (files.apk) {
      deleteFile(app.apk);
      app.apk = '/apps/' + files.apk[0].filename;
    }
    if (b.features !== undefined) app.features = parseJSON(b.features, []);

    app.updatedAt = new Date().toISOString();
    apps[idx] = app;
    db.write(apps);
    res.json(app);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── DELETE app ───────────────────────────────────
router.delete('/:id', (req, res) => {
  const apps = db.read();
  const app = apps.find(a => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });

  // clean up files
  deleteFile(app.icon);
  deleteFile(app.banner);
  (app.screenshots || []).forEach(deleteFile);
  deleteFile(app.apk);
  (app.updates || []).forEach(u => {
    deleteFile(u.apk);
    (u.screenshots || []).forEach(deleteFile);
  });

  db.write(apps.filter(a => a.id !== req.params.id));
  res.json({ ok: true });
});

// ── POST add update ───────────────────────────────
router.post('/:id/updates', uploadAll.fields([
  { name: 'apk', maxCount: 1 },
  { name: 'screenshots', maxCount: 10 }
]), (req, res) => {
  try {
    const apps = db.read();
    const idx = apps.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const b = req.body;
    const files = req.files || {};

    if (!b.version || !b.whatsNew) {
      return res.status(400).json({ error: 'version and whatsNew required' });
    }

    const update = {
      id: uuid(),
      version: b.version,
      whatsNew: b.whatsNew,
      apk: files.apk ? '/apps/' + files.apk[0].filename : '',
      screenshots: (files.screenshots || []).map(f => '/imgs/' + f.filename),
      date: new Date().toISOString()
    };

    // auto-hide all previous updates — admin can manually show them
    (apps[idx].updates || []).forEach(u => { u.hidden = true; });
    apps[idx].updates = [update, ...(apps[idx].updates || [])];
    // bump current version + apk if new apk uploaded
    apps[idx].version = b.version;
    if (files.apk) {
      deleteFile(apps[idx].apk);
      apps[idx].apk = update.apk;
    }
    apps[idx].updatedAt = new Date().toISOString();
    db.write(apps);
    res.json(apps[idx]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── PATCH toggle update visibility ───────────────
router.patch('/:id/updates/:uid/toggle', (req, res) => {
  const apps = db.read();
  const idx = apps.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const upd = (apps[idx].updates || []).find(u => u.id === req.params.uid);
  if (!upd) return res.status(404).json({ error: 'Update not found' });
  upd.hidden = !upd.hidden;
  db.write(apps);
  res.json({ hidden: upd.hidden });
});

// ── DELETE update ─────────────────────────────────
router.delete('/:id/updates/:uid', (req, res) => {
  const apps = db.read();
  const idx = apps.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const upd = (apps[idx].updates || []).find(u => u.id === req.params.uid);
  if (upd) {
    deleteFile(upd.apk);
    (upd.screenshots || []).forEach(deleteFile);
  }

  apps[idx].updates = (apps[idx].updates || []).filter(u => u.id !== req.params.uid);
  db.write(apps);
  res.json({ ok: true });
});

// ── util ──────────────────────────────────────────
function parseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = router;
