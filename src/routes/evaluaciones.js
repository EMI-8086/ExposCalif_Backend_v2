const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/evaluaciones
 * Admin/docente ven todas. Alumno solo ve las propias.
 * Query params: ?id_exposicion=1&id_alumno_evaluador=1
 */
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('evaluaciones')
    .select(`
      *,
      exposiciones(id_exposicion, titulo, fecha_exposicion),
      alumnos!id_alumno_evaluador(id_alumno, nombre, apellido, matricula),
      detalle_evaluacion(
        id_criterio, calificacion,
        criterios(nombre_criterio, peso)
      )
    `)
    .order('created_at', { ascending: false });

  if (req.query.id_exposicion) query = query.eq('id_exposicion', req.query.id_exposicion);
  if (req.query.id_alumno_evaluador) query = query.eq('id_alumno_evaluador', req.query.id_alumno_evaluador);

  // Si el usuario es alumno, solo ver sus propias evaluaciones
  if (req.userRole === 'alumno') {
    const { data: alumno } = await supabaseAdmin
      .from('alumnos')
      .select('id_alumno')
      .eq('id_usuario', req.user.id)
      .single();

    if (alumno) {
      query = query.eq('id_alumno_evaluador', alumno.id_alumno);
    }
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/**
 * GET /api/evaluaciones/:id
 */
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('evaluaciones')
    .select(`
      *,
      exposiciones(id_exposicion, titulo, fecha_exposicion),
      alumnos!id_alumno_evaluador(id_alumno, nombre, apellido, matricula),
      detalle_evaluacion(
        id_detalle, id_criterio, calificacion,
        criterios(nombre_criterio, descripcion, peso)
      )
    `)
    .eq('id_evaluacion', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Evaluación no encontrada.' });

  res.json(data);
});

/**
 * GET /api/evaluaciones/resumen/:id_exposicion
 * Calificación promedio ponderada por criterio para una exposición.
 */
router.get('/resumen/:id_exposicion', authorize('admin', 'docente'), async (req, res) => {
  const { data: detalles, error } = await supabaseAdmin
    .from('detalle_evaluacion')
    .select(`
      calificacion,
      criterios(id_criterio, nombre_criterio, peso),
      evaluaciones!inner(id_exposicion)
    `)
    .eq('evaluaciones.id_exposicion', req.params.id_exposicion);

  if (error) return res.status(500).json({ error: error.message });

  if (!detalles?.length) {
    return res.json({ message: 'No hay evaluaciones para esta exposición.', resumen: [] });
  }

  // Agrupar por criterio y calcular promedio ponderado
  const porCriterio = {};
  detalles.forEach(({ calificacion, criterios: criterio }) => {
    const key = criterio.id_criterio;
    if (!porCriterio[key]) {
      porCriterio[key] = { ...criterio, suma: 0, count: 0 };
    }
    porCriterio[key].suma += parseFloat(calificacion);
    porCriterio[key].count += 1;
  });

  const resumen = Object.values(porCriterio).map((c) => ({
    id_criterio: c.id_criterio,
    nombre_criterio: c.nombre_criterio,
    peso: c.peso,
    promedio: (c.suma / c.count).toFixed(2),
    total_evaluaciones: c.count,
  }));

  const calificacionFinal = resumen.reduce((acc, c) => {
    return acc + (parseFloat(c.promedio) * parseFloat(c.peso)) / 100;
  }, 0);

  res.json({
    id_exposicion: parseInt(req.params.id_exposicion),
    resumen,
    calificacion_final: calificacionFinal.toFixed(2),
  });
});

/**
 * POST /api/evaluaciones
 * Crea evaluación + detalle en una sola llamada.
 * Un alumno solo puede evaluar una vez por exposición.
 * Body:
 * {
 *   id_exposicion: number,
 *   id_alumno_evaluador: number,
 *   comentario_general?: string,
 *   calificaciones: [{ id_criterio: number, calificacion: number }]
 * }
 */
router.post('/', async (req, res) => {
  const { id_exposicion, id_alumno_evaluador, comentario_general, calificaciones } = req.body;

  if (!id_exposicion || !id_alumno_evaluador) {
    return res.status(400).json({ error: 'id_exposicion e id_alumno_evaluador son obligatorios.' });
  }

  if (!calificaciones || !Array.isArray(calificaciones) || calificaciones.length === 0) {
    return res.status(400).json({ error: 'calificaciones debe ser un arreglo con al menos un criterio.' });
  }

  // Validar rango de calificaciones
  for (const cal of calificaciones) {
    if (cal.calificacion < 0 || cal.calificacion > 10) {
      return res.status(400).json({ error: 'Cada calificación debe estar entre 0 y 10.' });
    }
  }

  // Crear evaluación
  const { data: evaluacion, error: evalError } = await supabaseAdmin
    .from('evaluaciones')
    .insert({ id_exposicion, id_alumno_evaluador, comentario_general: comentario_general || null })
    .select()
    .single();

  if (evalError) {
    if (evalError.code === '23505') {
      return res.status(409).json({ error: 'Este alumno ya evaluó esta exposición.' });
    }
    return res.status(400).json({ error: evalError.message });
  }

  // Insertar detalles (calificaciones por criterio)
  const detalles = calificaciones.map(({ id_criterio, calificacion }) => ({
    id_evaluacion: evaluacion.id_evaluacion,
    id_criterio,
    calificacion,
  }));

  const { data: detalleData, error: detalleError } = await supabaseAdmin
    .from('detalle_evaluacion')
    .insert(detalles)
    .select(`*, criterios(nombre_criterio, peso)`);

  if (detalleError) {
    // Rollback manual: borrar la evaluación creada
    await supabaseAdmin.from('evaluaciones').delete().eq('id_evaluacion', evaluacion.id_evaluacion);
    return res.status(400).json({ error: `Error al guardar calificaciones: ${detalleError.message}` });
  }

  res.status(201).json({
    message: 'Evaluación registrada correctamente.',
    evaluacion,
    detalle: detalleData,
  });
});

/**
 * PUT /api/evaluaciones/:id
 * Actualizar comentario general (las calificaciones se actualizan por detalle).
 * Body: { comentario_general? }
 */
router.put('/:id', async (req, res) => {
  const { comentario_general } = req.body;

  const { data, error } = await supabaseAdmin
    .from('evaluaciones')
    .update({ comentario_general })
    .eq('id_evaluacion', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Evaluación actualizada.', evaluacion: data });
});

/**
 * PUT /api/evaluaciones/:id/detalle/:id_criterio
 * Actualizar calificación de un criterio específico.
 * Body: { calificacion }
 */
router.put('/:id/detalle/:id_criterio', async (req, res) => {
  const { calificacion } = req.body;

  if (calificacion === undefined || calificacion < 0 || calificacion > 10) {
    return res.status(400).json({ error: 'calificacion debe estar entre 0 y 10.' });
  }

  const { data, error } = await supabaseAdmin
    .from('detalle_evaluacion')
    .update({ calificacion })
    .eq('id_evaluacion', req.params.id)
    .eq('id_criterio', req.params.id_criterio)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Calificación actualizada.', detalle: data });
});

/**
 * DELETE /api/evaluaciones/:id
 * Solo admin y docente.
 */
router.delete('/:id', authorize('admin', 'docente'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('evaluaciones')
    .delete()
    .eq('id_evaluacion', req.params.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: 'Evaluación eliminada.' });
});

module.exports = router;
