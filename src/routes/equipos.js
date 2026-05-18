const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/equipos
 * Query params: ?id_grupo=1
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('equipos')
    .select(`
      *,
      grupos(id_grupo, nombre_grupo, periodo, materias(nombre_materia)),
      equipo_alumno(
        alumnos(id_alumno, matricula, nombre, apellido, email)
      )
    `)
    .order('nombre_equipo');

  if (req.query.id_grupo) query = query.eq('id_grupo', req.query.id_grupo);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/equipos/:id
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('equipos')
    .select(`
      *,
      grupos(id_grupo, nombre_grupo, periodo, materias(nombre_materia)),
      equipo_alumno(
        alumnos(id_alumno, matricula, nombre, apellido, email)
      ),
      exposiciones(id_exposicion, titulo, fecha_exposicion)
    `)
    .eq('id_equipo', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Equipo no encontrado.' });

  res.json(data);
});

/**
 * POST /api/equipos
 * Body: { nombre_equipo, id_grupo, alumno_ids?: number[] }
 */
router.post('/', authorize('admin', 'docente'), async (req, res) => {
  const { nombre_equipo, id_grupo, alumno_ids = [] } = req.body;

  if (!nombre_equipo || !id_grupo) {
    return res.status(400).json({ error: 'nombre_equipo e id_grupo son obligatorios.' });
  }

  const { data: equipo, error } = await supabaseAdmin
    .from('equipos')
    .insert({ nombre_equipo, id_grupo })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Agregar alumnos si se proporcionaron
  if (alumno_ids.length > 0) {
    const relaciones = alumno_ids.map((id_alumno) => ({
      id_equipo: equipo.id_equipo,
      id_alumno,
    }));

    const { error: relError } = await supabaseAdmin.from('equipo_alumno').insert(relaciones);
    if (relError) {
      // Equipo creado pero sin alumnos — avisar
      return res.status(201).json({
        message: 'Equipo creado, pero error al agregar alumnos.',
        equipo,
        warning: relError.message,
      });
    }
  }

  res.status(201).json({ message: 'Equipo creado.', equipo });
});

/**
 * PUT /api/equipos/:id
 * Body: { nombre_equipo?, id_grupo? }
 */
router.put('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { nombre_equipo, id_grupo } = req.body;
  const updates = {};

  if (nombre_equipo) updates.nombre_equipo = nombre_equipo;
  if (id_grupo) updates.id_grupo = id_grupo;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('equipos')
    .update(updates)
    .eq('id_equipo', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Equipo actualizado.', equipo: data });
});

/**
 * DELETE /api/equipos/:id
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin.from('equipos').delete().eq('id_equipo', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Equipo eliminado.' });
});

// ─── Gestión de Miembros del Equipo ─────────────────────────────────────────

/**
 * POST /api/equipos/:id/alumnos
 * Agregar alumnos a un equipo.
 * Body: { alumno_ids: number[] }
 */
router.post('/:id/alumnos', authorize('admin', 'docente'), async (req, res) => {
  const { alumno_ids } = req.body;

  if (!alumno_ids || !Array.isArray(alumno_ids) || alumno_ids.length === 0) {
    return res.status(400).json({ error: 'alumno_ids debe ser un arreglo con al menos un id.' });
  }

  const relaciones = alumno_ids.map((id_alumno) => ({
    id_equipo: parseInt(req.params.id),
    id_alumno,
  }));

  const { data, error } = await supabaseAdmin
    .from('equipo_alumno')
    .insert(relaciones)
    .select();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Uno o más alumnos ya pertenecen a este equipo.' });
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ message: 'Alumnos agregados al equipo.', relaciones: data });
});

/**
 * DELETE /api/equipos/:id/alumnos/:alumnoId
 * Remover un alumno de un equipo.
 */
router.delete('/:id/alumnos/:alumnoId', authorize('admin', 'docente'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('equipo_alumno')
    .delete()
    .eq('id_equipo', req.params.id)
    .eq('id_alumno', req.params.alumnoId);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Alumno removido del equipo.' });
});

module.exports = router;
