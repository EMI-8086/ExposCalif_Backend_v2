const { supabaseAdmin } = require('../config/supabase');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Falta el token Bearer.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      console.log('Error de Supabase Auth:', error);
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('rol, nombre, apellido')
      .eq('id_usuario', data.user.id)
      .single();

    if (usuarioError) {
      console.log('Error al buscar en tabla usuarios:', usuarioError);
      return res.status(401).json({ error: 'Usuario no encontrado en el sistema.' });
    }

    req.user = data.user;
    req.userRole = usuarioData.rol;
    req.token = token;

    next();
  } catch (err) {
    console.error('Error en middleware de autenticación:', err);
    res.status(500).json({ error: 'Error interno al verificar autenticación.' });
  }
};


const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de los roles: ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
