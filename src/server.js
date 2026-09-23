require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path = require('path');
const fs = require('fs');
const apiRouter = require('./routes/api');
const aiRouter = require('./routes/ai');
const { getDashboard } = require('./db');
const { injectAiBridge } = require('./aiBridge');

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, '..', 'public');
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'clipboard-write=(self)');
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/api', apiRouter);
app.use('/api/ai', aiRouter);

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

app.get('/view/:id', (req, res) => {
  const dashboard = getDashboard(req.params.id);
  if (!dashboard) {
    return res.status(404).send('Dashboard no encontrado');
  }

  const filePath = path.join(uploadsDir, path.basename(dashboard.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Archivo del dashboard no encontrado');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");

  if (dashboard.needsAi) {
    const html = fs.readFileSync(filePath, 'utf8');
    return res.send(injectAiBridge(html, dashboard.id));
  }

  res.sendFile(filePath);
});

app.get(['/manual', '/manual/'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'manual', 'index.html'));
});

app.get(['/admin', '/admin/'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'client', 'index.html'));
});

app.use(
  express.static(publicDir, {
    index: false,
    redirect: false,
  })
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Dashboards listo en http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn('Aviso: OPENAI_API_KEY no está definida. Los dashboards con IA fallarán hasta configurarla en .env');
  }
});
