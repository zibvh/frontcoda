const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// ensure dirs exist
['public/apps', 'public/imgs', 'data'].forEach(d => {
  fs.mkdirSync(path.join(__dirname, d), { recursive: true });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/apps', require('./routes/apps'));

// SPA fallback — /admin serves admin.html, everything else index.html
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`frntcoda running → http://localhost:${PORT}`));
