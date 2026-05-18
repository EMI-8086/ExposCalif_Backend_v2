const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/usuarios
 * Admin y docente ven todos. Alumno solo se ve a sí mismo.
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin.from('usuarios').select('*').order('apellido');

  if (req.userRole === 'alumno') {
    query = query.eq('id_usuario', req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/usuarios/:id
 */
router.get('/:id', async (req, res) => {
  // Alumno solo puede ver su propio perfil
  if (req.userRole === 'alumno' && req.params.id !== req.user.id) {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('id_usuario', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado.' });

  res.json(data);
});

/**
 * POST /api/usuarios
 * Ruta pública para registro de alumnos.
 * Body: { email, password, nombre, apellido }
 */
router.post('/', async (req, res) => {
  const { email, password, nombre, apellido } = req.body;

  if (!email || !password || !nombre || !apellido) {
    return res.status(400).json({ error: 'email, password, nombre y apellido son obligatorios.' });
  }

  // Forzamos el rol a 'alumno'
  const rolAsignado = 'alumno';

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { 
      nombre, 
      apellido, 
      rol: rolAsignado 
    },
  });

  if (error) return res.status(400).json({ error: error.message });

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('id_usuario', data.user.id)
    .single();

  res.status(201).json({ message: 'Cuenta de alumno creada correctamente.', usuario });
});

/**
 * PUT /api/usuarios/:id
 * Admin puede actualizar cualquier campo. El propio usuario puede actualizar su perfil básico.
 * Body: { nombre?, apellido?, matricula?, rol? }
 */
router.put('/:id', async (req, res) => {
  const isOwnProfile = req.params.id === req.user.id;

  if (!isOwnProfile && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { nombre, apellido, matricula, rol } = req.body;
  const updates = {};

  if (nombre) updates.nombre = nombre;
  if (apellido) updates.apellido = apellido;
  if (matricula) updates.matricula = matricula;
  // Solo admin puede cambiar rol
  if (rol && req.userRole === 'admin') updates.rol = rol;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(updates)
    .eq('id_usuario', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Usuario actualizado.', usuario: data });
});

/**
 * DELETE /api/usuarios/:id
 * Solo admin. Elimina de auth.users (cascade borra public.usuarios).
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Usuario eliminado correctamente.' });
});

module.exports = router;
