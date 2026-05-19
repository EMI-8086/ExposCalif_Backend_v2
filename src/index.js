require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const materiasRoutes = require('./routes/materias');
const gruposRoutes = require('./routes/grupos');
const alumnosRoutes = require('./routes/alumnos');
const equiposRoutes = require('./routes/equipos');
const exposicionesRoutes = require('./routes/exposiciones');
const criteriosRoutes = require('./routes/criterios');
const evaluacionesRoutes = require('./routes/evaluaciones');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middlewares globales ────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://expos-calif-frontend.vercel.app', // Para producción en Vercel
    'http://localhost:5173'                    // Para desarrollo local
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ExposCalif API corriendo',
    timestamp: new Date().toISOString(),
  });
});

// ─── Rutas ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/materias', materiasRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/exposiciones', exposicionesRoutes);
app.use('/api/criterios', criteriosRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// ─── Error handler global ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ─── Inicio ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ExposCalif API corriendo en http://localhost:${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
