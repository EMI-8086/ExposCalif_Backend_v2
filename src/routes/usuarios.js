const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/usuarios
 * Admin y docente ven todos. Alumno/docente solo se ven a sí mismos.
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin.from('usuarios').select('*').order('apellido');

  if (req.userRole !== 'admin') {
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
  // Solo admin puede ver perfiles ajenos
  if (req.params.id !== req.user.id && req.userRole !== 'admin') {
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
 * Solo admin.
 * Body: { email, password, nombre, apellido, rol, matricula? }
 *
 * Flujo:
 *  1. Crea en auth.users  → trigger inserta en public.usuarios automáticamente
 *  2. Si hay matrícula    → la actualiza en public.usuarios
 *  3. Si rol === 'alumno' → crea también el registro en public.alumnos y lo vincula
 */
router.post('/', authorize('admin'), async (req, res) => {
  const { email, password, nombre, apellido, rol = 'alumno', matricula } = req.body;

  if (!email || !password || !nombre || !apellido) {
    return res.status(400).json({ error: 'email, password, nombre y apellido son obligatorios.' });
  }

  // 1 — Crear en auth.users (el trigger crea public.usuarios)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, rol },
  });

  if (authError) return res.status(400).json({ error: authError.message });

  const userId = authData.user.id;

  // 2 — Actualizar matrícula en public.usuarios si se envió
  if (matricula) {
    await supabaseAdmin
      .from('usuarios')
      .update({ matricula })
      .eq('id_usuario', userId);
  }

  // 3 — Si es alumno: crear registro en public.alumnos y vincular id_usuario
  if (rol === 'alumno') {
    const { error: alumnoError } = await supabaseAdmin
      .from('alumnos')
      .insert({
        matricula: matricula || `ALU-${userId.slice(0, 8).toUpperCase()}`,
        nombre,
        apellido,
        email,
        id_usuario: userId,
      });

    if (alumnoError) {
      // El usuario ya existe en auth — avisar pero no bloquear
      console.warn('Advertencia al crear registro de alumno:', alumnoError.message);
    }
  }

  // Responder con el registro de public.usuarios
  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('id_usuario', userId)
    .single();

  res.status(201).json({ message: 'Usuario creado correctamente.', usuario });
});

/**
 * PUT /api/usuarios/:id
 * Admin puede actualizar rol. Cualquier usuario puede actualizar su propio perfil (sin rol).
 * Body: { nombre?, apellido?, matricula?, rol? }
 */
router.put('/:id', async (req, res) => {
  const isOwnProfile = req.params.id === req.user.id;

  if (!isOwnProfile && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { nombre, apellido, matricula, rol } = req.body;
  const updates = {};

  if (nombre)    updates.nombre    = nombre;
  if (apellido)  updates.apellido  = apellido;
  if (matricula !== undefined) updates.matricula = matricula || null;
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

  // Si el usuario tiene un registro en alumnos, sincronizar nombre/apellido/email
  if (nombre || apellido) {
    const syncAlumno = {};
    if (nombre)   syncAlumno.nombre   = nombre;
    if (apellido) syncAlumno.apellido = apellido;

    await supabaseAdmin
      .from('alumnos')
      .update(syncAlumno)
      .eq('id_usuario', req.params.id);
  }

  res.json({ message: 'Perfil actualizado.', usuario: data });
});

/**
 * DELETE /api/usuarios/:id
 * Solo admin. Elimina de auth.users → cascade borra public.usuarios.
 * El registro de alumnos se limpia por ON DELETE SET NULL en id_usuario.
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Usuario eliminado correctamente.' });
});

module.exports = router;
