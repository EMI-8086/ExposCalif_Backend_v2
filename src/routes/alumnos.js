const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/alumnos
 * Query params: ?search=nombre&id_grupo=1
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('alumnos')
    .select('*')
    .order('apellido');

  if (req.query.search) {
    query = query.or(
      `nombre.ilike.%${req.query.search}%,apellido.ilike.%${req.query.search}%,matricula.ilike.%${req.query.search}%`
    );
  }

  if (req.query.id_grupo) {
    // Alumnos que pertenecen a algún equipo del grupo
    const { data: equiposGrupo } = await supabaseAdmin
      .from('equipos')
      .select('id_equipo')
      .eq('id_grupo', req.query.id_grupo);

    if (equiposGrupo?.length) {
      const ids = equiposGrupo.map((e) => e.id_equipo);
      const { data: relaciones } = await supabaseAdmin
        .from('equipo_alumno')
        .select('id_alumno')
        .in('id_equipo', ids);

      const alumnoIds = [...new Set(relaciones?.map((r) => r.id_alumno))];
      query = query.in('id_alumno', alumnoIds);
    }
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/alumnos/:id
 * Incluye equipos del alumno.
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('alumnos')
    .select(`
      *,
      equipo_alumno(
        equipos(
          id_equipo, nombre_equipo,
          grupos(id_grupo, nombre_grupo, periodo, materias(nombre_materia))
        )
      )
    `)
    .eq('id_alumno', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Alumno no encontrado.' });

  res.json(data);
});

/**
 * POST /api/alumnos
 * Solo admin y docente.
 * Body: { matricula, nombre, apellido, email, id_usuario? }
 */
router.post('/', authorize('admin', 'docente'), async (req, res) => {
  const { matricula, nombre, apellido, email, id_usuario } = req.body;

  if (!matricula || !nombre || !apellido || !email) {
    return res.status(400).json({ error: 'matricula, nombre, apellido y email son obligatorios.' });
  }

  const { data, error } = await supabaseAdmin
    .from('alumnos')
    .insert({ matricula, nombre, apellido, email, id_usuario: id_usuario || null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Matrícula o email ya registrado.' });
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ message: 'Alumno creado.', alumno: data });
});

/**
 * PUT /api/alumnos/:id
 * Body: { nombre?, apellido?, email?, matricula?, id_usuario? }
 */
router.put('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { nombre, apellido, email, matricula, id_usuario } = req.body;
  const updates = {};

  if (nombre) updates.nombre = nombre;
  if (apellido) updates.apellido = apellido;
  if (email) updates.email = email;
  if (matricula) updates.matricula = matricula;
  if (id_usuario !== undefined) updates.id_usuario = id_usuario;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('alumnos')
    .update(updates)
    .eq('id_alumno', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Alumno actualizado.', alumno: data });
});

/**
 * DELETE /api/alumnos/:id
 * Solo admin.
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('alumnos')
    .delete()
    .eq('id_alumno', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Alumno eliminado.' });
});

module.exports = router;
