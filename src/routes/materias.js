const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/materias
 * Todos los autenticados pueden ver materias.
 * Query params: ?search=nombre
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('materias')
    .select('*, criterios(count)')
    .order('nombre_materia');

  if (req.query.search) {
    query = query.ilike('nombre_materia', `%${req.query.search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/materias/:id
 * Incluye criterios de la materia.
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('materias')
    .select(`
      *,
      criterios(*),
      grupos(*)
    `)
    .eq('id_materia', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Materia no encontrada.' });

  res.json(data);
});

/**
 * POST /api/materias
 * Solo admin y docente.
 * Body: { clave_materia, nombre_materia }
 */
router.post('/', authorize('admin', 'docente'), async (req, res) => {
  const { clave_materia, nombre_materia } = req.body;

  if (!clave_materia || !nombre_materia) {
    return res.status(400).json({ error: 'clave_materia y nombre_materia son obligatorios.' });
  }

  const { data, error } = await supabaseAdmin
    .from('materias')
    .insert({ clave_materia: clave_materia.toUpperCase(), nombre_materia })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'La clave de materia ya existe.' });
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ message: 'Materia creada.', materia: data });
});

/**
 * PUT /api/materias/:id
 * Solo admin y docente.
 * Body: { clave_materia?, nombre_materia? }
 */
router.put('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { clave_materia, nombre_materia } = req.body;
  const updates = {};

  if (clave_materia) updates.clave_materia = clave_materia.toUpperCase();
  if (nombre_materia) updates.nombre_materia = nombre_materia;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('materias')
    .update(updates)
    .eq('id_materia', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Materia actualizada.', materia: data });
});

/**
 * DELETE /api/materias/:id
 * Solo admin.
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('materias')
    .delete()
    .eq('id_materia', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Materia eliminada.' });
});

module.exports = router;
