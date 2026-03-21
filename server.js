const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const VOLUME_DIR = '/data';
const DATA_FILE = path.join(VOLUME_DIR, 'heures.json');
const SEED_FILE = path.join(__dirname, 'data', 'heures.json');

// On startup: copy seed data to volume only if volume file doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.mkdirSync(VOLUME_DIR, { recursive: true });
  fs.copyFileSync(SEED_FILE, DATA_FILE);
  console.log('Initialized data from seed file');
} else {
  console.log('Using existing data from volume');
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  data.derniere_maj = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Get all projects
app.get('/api/projects', (req, res) => {
  res.json(readData());
});

// Start a session
app.post('/api/start', (req, res) => {
  const { projet } = req.body;
  if (!projet) return res.status(400).json({ error: 'projet requis' });

  const data = readData();
  if (!data.projets[projet]) return res.status(404).json({ error: 'projet inconnu' });

  // Store active session info
  if (!data._active) data._active = {};
  data._active[projet] = { debut: new Date().toISOString(), user: req.body.user || 'Ascher' };
  writeData(data);
  res.json({ ok: true, debut: data._active[projet].debut });
});

// Stop a session
app.post('/api/stop', (req, res) => {
  const { projet, note } = req.body;
  if (!projet) return res.status(400).json({ error: 'projet requis' });

  const data = readData();
  if (!data._active || !data._active[projet]) return res.status(400).json({ error: 'pas de session active' });

  const session = data._active[projet];
  const debut = new Date(session.debut);
  const fin = new Date();
  const seconds = (fin - debut) / 1000;
  if (seconds < 60) {
    delete data._active[projet];
    if (Object.keys(data._active).length === 0) delete data._active;
    writeData(data);
    return res.json({ ok: true, skipped: true, message: 'Session < 1 min, non enregistree' });
  }
  const heures = Math.round(seconds / 60) / 60; // en heures, arrondi a la minute
  const roundedHeures = Math.max(0.1, Math.round(heures * 10) / 10);

  // Add session
  data.projets[projet].sessions.push({
    debut: debut.toISOString().slice(0, 16).replace('T', ' '),
    fin: fin.toISOString().slice(0, 16).replace('T', ' '),
    heures: roundedHeures,
    user: session.user || 'ascher',
    source: 'tracker',
    note: note || ''
  });
  data.projets[projet].total_heures = Math.round((data.projets[projet].total_heures + roundedHeures) * 10) / 10;

  delete data._active[projet];
  if (Object.keys(data._active).length === 0) delete data._active;

  writeData(data);
  res.json({ ok: true, heures: roundedHeures, total: data.projets[projet].total_heures });
});

// Add a new project (owners can be array or string)
app.post('/api/project', (req, res) => {
  const { nom, dossier, owners } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requis' });

  const data = readData();
  if (data.projets[nom]) return res.status(400).json({ error: 'projet existe deja' });

  data.projets[nom] = {
    dossier: dossier || '',
    total_heures: 0,
    owners: owners || ['ascher'],
    sessions: []
  };
  writeData(data);
  res.json({ ok: true });
});

// Manual time entry
app.post('/api/manual', (req, res) => {
  const { projet, heures, note } = req.body;
  if (!projet || !heures) return res.status(400).json({ error: 'projet et heures requis' });

  const data = readData();
  if (!data.projets[projet]) return res.status(404).json({ error: 'projet inconnu' });

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const h = Math.round(parseFloat(heures) * 10) / 10;

  data.projets[projet].sessions.push({
    debut: now, fin: now, heures: h, source: 'manual', note: note || ''
  });
  data.projets[projet].total_heures = Math.round((data.projets[projet].total_heures + h) * 10) / 10;

  writeData(data);
  res.json({ ok: true, total: data.projets[projet].total_heures });
});

// Delete last session of a project
app.post('/api/delete-session', (req, res) => {
  const { projet, index } = req.body;
  if (!projet) return res.status(400).json({ error: 'projet requis' });

  const data = readData();
  if (!data.projets[projet]) return res.status(404).json({ error: 'projet inconnu' });

  const sessions = data.projets[projet].sessions;
  const idx = index !== undefined ? index : sessions.length - 1;
  if (idx < 0 || idx >= sessions.length) return res.status(400).json({ error: 'index invalide' });

  const removed = sessions.splice(idx, 1)[0];
  data.projets[projet].total_heures = Math.round((data.projets[projet].total_heures - removed.heures) * 10) / 10;
  if (data.projets[projet].total_heures < 0) data.projets[projet].total_heures = 0;

  writeData(data);
  res.json({ ok: true, removed, total: data.projets[projet].total_heures });
});

// Update project owners
app.post('/api/update-owners', (req, res) => {
  const { projet, owners } = req.body;
  if (!projet || !owners || !Array.isArray(owners) || owners.length === 0) return res.status(400).json({ error: 'projet et owners requis' });

  const data = readData();
  if (!data.projets[projet]) return res.status(404).json({ error: 'projet inconnu' });

  data.projets[projet].owners = owners;
  // Clean old owner field if exists
  delete data.projets[projet].owner;
  writeData(data);
  res.json({ ok: true, owners });
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`Heures Tracker on port ${PORT}`));
