const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/grupos
 * Query params: ?id_materia=1&periodo=2025-1
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('grupos')
    .select(`
      *,
      materias(id_materia, clave_materia, nombre_materia),
      equipos(count)
    `)
    .order('nombre_grupo');

  if (req.query.id_materia) query = query.eq('id_materia', req.query.id_materia);
  if (req.query.periodo) query = query.eq('periodo', req.query.periodo);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/grupos/:id
 * Incluye equipos y sus alumnos.
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('grupos')
    .select(`
      *,
      materias(id_materia, clave_materia, nombre_materia),
      equipos(
        *,
        equipo_alumno(
          alumnos(id_alumno, matricula, nombre, apellido, email)
        )
      )
    `)
    .eq('id_grupo', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Grupo no encontrado.' });

  res.json(data);
});

/**
 * POST /api/grupos
 * Solo admin y docente.
 * Body: { nombre_grupo, periodo, id_materia }
 */
router.post('/', authorize('admin', 'docente'), async (req, res) => {
  const { nombre_grupo, periodo, id_materia } = req.body;

  if (!nombre_grupo || !periodo || !id_materia) {
    return res.status(400).json({ error: 'nombre_grupo, periodo e id_materia son obligatorios.' });
  }

  const { data, error } = await supabaseAdmin
    .from('grupos')
    .insert({ nombre_grupo, periodo, id_materia })
    .select(`*, materias(nombre_materia)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ message: 'Grupo creado.', grupo: data });
});

/**
 * PUT /api/grupos/:id
 * Body: { nombre_grupo?, periodo?, id_materia? }
 */
router.put('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { nombre_grupo, periodo, id_materia } = req.body;
  const updates = {};

  if (nombre_grupo) updates.nombre_grupo = nombre_grupo;
  if (periodo) updates.periodo = periodo;
  if (id_materia) updates.id_materia = id_materia;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('grupos')
    .update(updates)
    .eq('id_grupo', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Grupo actualizado.', grupo: data });
});

/**
 * DELETE /api/grupos/:id
 * Solo admin.
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin.from('grupos').delete().eq('id_grupo', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Grupo eliminado.' });
});

module.exports = router;
