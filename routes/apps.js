const router = require('express').Router();
const App = require('../models/App');

// GET all apps (public — no images to keep payload light)
router.get('/', async (req, res) => {
  try {
    const apps = await App.find()
      .select('-screenshots -banner -updates')
      .sort({ order: 1, createdAt: 1 });
    res.json(apps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single app (full data)
router.get('/:id', async (req, res) => {
  try {
    const app = await App.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    res.json(app);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create app
router.post('/', async (req, res) => {
  try {
    const app = new App(req.body);
    await app.save();
    res.status(201).json(app);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT update app (full or partial)
router.put('/:id', async (req, res) => {
  try {
    const app = await App.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });

    const allowed = [
      'name','tagline','about','category','platform','version',
      'size','downloadUrl','rating','downloads','icon','banner',
      'screenshots','features','order'
    ];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) app[k] = req.body[k];
    });
    app.updatedAt = new Date();
    await app.save();
    res.json(app);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE app
router.delete('/:id', async (req, res) => {
  try {
    await App.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── UPDATES ────────────────────────────────────

// POST add update
router.post('/:id/updates', async (req, res) => {
  try {
    const app = await App.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    app.updates.unshift({
      version: req.body.version,
      whatsNew: req.body.whatsNew,
      screenshots: req.body.screenshots || [],
      date: new Date()
    });
    app.version = req.body.version; // bump current version
    app.updatedAt = new Date();
    await app.save();
    res.json(app);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE an update entry
router.delete('/:id/updates/:uid', async (req, res) => {
  try {
    const app = await App.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    app.updates = app.updates.filter(u => u._id.toString() !== req.params.uid);
    await app.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
