const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  // Obtener info del usuario
  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id_usuario, nombre, apellido, email, rol, matricula')
    .eq('id_usuario', data.user.id)
    .single();

  res.json({
    message: 'Login exitoso',
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    usuario,
  });
});

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 */
router.post('/logout', authenticate, async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.signOut(req.token);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Sesión cerrada correctamente.' });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
router.get('/me', authenticate, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id_usuario, nombre, apellido, email, rol, matricula, created_at')
    .eq('id_usuario', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado.' });

  res.json(data);
});

module.exports = router;
