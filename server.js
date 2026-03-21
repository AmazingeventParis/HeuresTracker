const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'heures.json');

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
  const heures = Math.round((fin - debut) / 1000 / 60) / 60; // en heures, arrondi a la minute
  const roundedHeures = Math.round(heures * 10) / 10;

  // Add session
  data.projets[projet].sessions.push({
    debut: debut.toISOString().slice(0, 16).replace('T', ' '),
    fin: fin.toISOString().slice(0, 16).replace('T', ' '),
    heures: roundedHeures,
    source: 'tracker',
    note: note || ''
  });
  data.projets[projet].total_heures = Math.round((data.projets[projet].total_heures + roundedHeures) * 10) / 10;

  delete data._active[projet];
  if (Object.keys(data._active).length === 0) delete data._active;

  writeData(data);
  res.json({ ok: true, heures: roundedHeures, total: data.projets[projet].total_heures });
});

// Add a new project
app.post('/api/project', (req, res) => {
  const { nom, dossier, owner } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requis' });

  const data = readData();
  if (data.projets[nom]) return res.status(400).json({ error: 'projet existe deja' });

  data.projets[nom] = {
    dossier: dossier || '',
    total_heures: 0,
    owner: owner || 'Ascher',
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

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`Heures Tracker on port ${PORT}`));
