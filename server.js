'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

getDb();


// ── API Routes ────────────────────────────────────────────
app.use('/api/employees', require('./routes/employees'));
app.use('/api/leave',     require('./routes/leave'));
app.use('/api/payroll',   require('./routes/payroll'));


app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  HR & Payroll System running at http://localhost:${PORT}`);
  console.log(`   API docs: http://localhost:${PORT}/api/employees`);
});
