const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/criterios
 * Query params: ?id_materia=1
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('criterios')
    .select('*, materias(nombre_materia)')
    .order('nombre_criterio');

  if (req.query.id_materia) query = query.eq('id_materia', req.query.id_materia);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/criterios/:id
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('criterios')
    .select('*, materias(nombre_materia)')
    .eq('id_criterio', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Criterio no encontrado.' });

  res.json(data);
});

/**
 * POST /api/criterios
 * Solo admin y docente.
 * Body: { nombre_criterio, descripcion?, peso, id_materia }
 */
router.post('/', authorize('admin', 'docente'), async (req, res) => {
  const { nombre_criterio, descripcion, peso, id_materia } = req.body;

  if (!nombre_criterio || !peso || !id_materia) {
    return res.status(400).json({ error: 'nombre_criterio, peso e id_materia son obligatorios.' });
  }

  if (peso <= 0) {
    return res.status(400).json({ error: 'El peso debe ser mayor a 0.' });
  }

  const { data, error } = await supabaseAdmin
    .from('criterios')
    .insert({ nombre_criterio, descripcion: descripcion || null, peso, id_materia })
    .select('*, materias(nombre_materia)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ message: 'Criterio creado.', criterio: data });
});

/**
 * PUT /api/criterios/:id
 * Body: { nombre_criterio?, descripcion?, peso?, id_materia? }
 */
router.put('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { nombre_criterio, descripcion, peso, id_materia } = req.body;
  const updates = {};

  if (nombre_criterio) updates.nombre_criterio = nombre_criterio;
  if (descripcion !== undefined) updates.descripcion = descripcion;
  if (peso !== undefined) {
    if (peso <= 0) return res.status(400).json({ error: 'El peso debe ser mayor a 0.' });
    updates.peso = peso;
  }
  if (id_materia) updates.id_materia = id_materia;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('criterios')
    .update(updates)
    .eq('id_criterio', req.params.id)
    .select('*, materias(nombre_materia)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Criterio actualizado.', criterio: data });
});

/**
 * DELETE /api/criterios/:id
 * Solo admin.
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('criterios')
    .delete()
    .eq('id_criterio', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Criterio eliminado.' });
});

module.exports = router;
