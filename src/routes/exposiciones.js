const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/exposiciones
 * Query params: ?id_equipo=1&id_grupo=1
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('exposiciones')
    .select(`
      *,
      equipos(
        id_equipo, nombre_equipo,
        grupos(id_grupo, nombre_grupo, periodo, materias(nombre_materia))
      ),
      evaluaciones(count)
    `)
    .order('fecha_exposicion', { ascending: false });

  if (req.query.id_equipo) query = query.eq('id_equipo', req.query.id_equipo);

  if (req.query.id_grupo) {
    const { data: equipos } = await supabaseAdmin
      .from('equipos')
      .select('id_equipo')
      .eq('id_grupo', req.query.id_grupo);

    if (equipos?.length) {
      query = query.in('id_equipo', equipos.map((e) => e.id_equipo));
    }
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/exposiciones/:id
 * Incluye evaluaciones y detalle.
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('exposiciones')
    .select(`
      *,
      equipos(
        id_equipo, nombre_equipo,
        grupos(id_grupo, nombre_grupo, periodo, materias(nombre_materia)),
        equipo_alumno(alumnos(id_alumno, nombre, apellido, matricula))
      ),
      evaluaciones(
        id_evaluacion, comentario_general, created_at,
        alumnos!id_alumno_evaluador(nombre, apellido, matricula),
        detalle_evaluacion(
          id_criterio, calificacion,
          criterios(nombre_criterio, peso)
        )
      )
    `)
    .eq('id_exposicion', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Exposición no encontrada.' });

  res.json(data);
});

/**
 * POST /api/exposiciones
 * Solo admin y docente.
 * Body: { titulo, fecha_exposicion, id_equipo, rubrica? }
 */
router.post('/', authorize('admin', 'docente'), async (req, res) => {
  const { titulo, fecha_exposicion, id_equipo, rubrica } = req.body;

  if (!titulo || !fecha_exposicion || !id_equipo) {
    return res.status(400).json({ error: 'titulo, fecha_exposicion e id_equipo son obligatorios.' });
  }

  const { data, error } = await supabaseAdmin
    .from('exposiciones')
    .insert({
      titulo,
      fecha_exposicion,
      id_equipo,
      rubrica: rubrica || null,
    })
    .select(`*, equipos(nombre_equipo)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ message: 'Exposición creada.', exposicion: data });
});

/**
 * PUT /api/exposiciones/:id
 * Body: { titulo?, fecha_exposicion?, id_equipo?, rubrica? }
 */
router.put('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { titulo, fecha_exposicion, id_equipo, rubrica } = req.body;
  const updates = {};

  if (titulo) updates.titulo = titulo;
  if (fecha_exposicion) updates.fecha_exposicion = fecha_exposicion;
  if (id_equipo) updates.id_equipo = id_equipo;
  if (rubrica !== undefined) updates.rubrica = rubrica;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('exposiciones')
    .update(updates)
    .eq('id_exposicion', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Exposición actualizada.', exposicion: data });
});

/**
 * DELETE /api/exposiciones/:id
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('exposiciones')
    .delete()
    .eq('id_exposicion', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Exposición eliminada.' });
});

module.exports = router;
