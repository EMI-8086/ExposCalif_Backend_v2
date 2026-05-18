# ExposCalif – Backend API

REST API para el sistema de calificación de exposiciones, construida con **Node.js + Express** y conectada a **Supabase**.

---

## Stack

| Tecnología | Uso |
|---|---|
| Node.js 18+ | Runtime |
| Express 4 | Framework HTTP |
| Supabase JS | Cliente de base de datos + Auth |
| dotenv | Variables de entorno |
| cors | Cross-Origin Resource Sharing |

---

## Setup local

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd exposcalif-backend

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env 
cp .env

# 4. Iniciar el servidor en modo desarrollo
npm run dev

---

## Variables de entorno

```env
PORT=4000
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
---

## Convención de commits

```
Formato
<tipo>(<alcance>): <descripción breve>
https://gist.github.com/pipetboy2001/e26cdf1828a820a81cd39da3d776abac

Tipo	Descripción
feat	Nueva funcionalidad o característica
fix	Corrección de errores
refactor	Refactorización sin cambiar la lógica
docs	Cambios en documentación
style	Cambios de formato o estilo (sin afectar la lógica)
perf	Mejoras de rendimiento
test	Agregar o actualizar tests
chore	Tareas de mantenimiento (deps, tooling, build, etc.)
ci	Cambios en CI/CD o automatización
core	Cambios en funcionalidad central o infraestructura

Alcance	Descripción
ui	Componentes de interfaz de usuario
auth	Sistema de autenticación
api	Endpoints o lógica backend
db	Modelos o consultas de base de datos
config	Configuración del proyecto
archivos	Subida/descarga o manejo de archivos
routes	Sistema de rutas o navegación
security	Cambios de seguridad o validaciones
performance	Optimizaciones de rendimiento
```

Ejemplo: `feat(misiones): agregar nueva misión de reconocimiento`

---

## Cómo probar en Postman

### 1. Login (obtener token)

```
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "admin@gmail.com",
  "password": "tu-password"
}
```

Copia el `access_token` de la respuesta.

### 2. Autenticación en Postman

En cada request, ve a la pestaña **Authorization** → **Bearer Token** y pega el token.

O usa una **Collection Variable** `{{token}}` para no repetirlo.

---

## Endpoints

### Auth

| Método | Endpoint | Descripción | Auth requerido |
|---|---|---|---|
| POST | `/api/auth/login` | Login con email/password | No |
| POST | `/api/auth/logout` | Cerrar sesión | Sí |
| GET | `/api/auth/me` | Datos del usuario autenticado | Sí |

### Usuarios

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/usuarios` | Listar todos | admin/docente |
| GET | `/api/usuarios/:id` | Ver uno | propio o admin |
| POST | `/api/usuarios` | Crear (crea en auth.users) | admin |
| PUT | `/api/usuarios/:id` | Actualizar | propio o admin |
| DELETE | `/api/usuarios/:id` | Eliminar | admin |

**POST body:**
```json
{
  "email": "juan@gmail.com",
  "password": "segura123",
  "nombre": "Juan",
  "apellido": "López",
  "rol": "alumno",
  "matricula": "A230001"
}
```

### Materias

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/materias` | Listar (`?search=nombre`) | todos |
| GET | `/api/materias/:id` | Ver con criterios y grupos | todos |
| POST | `/api/materias` | Crear | admin/docente |
| PUT | `/api/materias/:id` | Actualizar | admin/docente |
| DELETE | `/api/materias/:id` | Eliminar | admin |

**POST body:**
```json
{
  "clave_materia": "PROG101",
  "nombre_materia": "Programación Orientada a Objetos"
}
```

### Grupos

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/grupos` | Listar (`?id_materia=1&periodo=2025-1`) | todos |
| GET | `/api/grupos/:id` | Ver con equipos y alumnos | todos |
| POST | `/api/grupos` | Crear | admin/docente |
| PUT | `/api/grupos/:id` | Actualizar | admin/docente |
| DELETE | `/api/grupos/:id` | Eliminar | admin |

**POST body:**
```json
{
  "nombre_grupo": "Grupo A",
  "periodo": "2025-1",
  "id_materia": 1
}
```

### Alumnos

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/alumnos` | Listar (`?search=nombre&id_grupo=1`) | admin/docente |
| GET | `/api/alumnos/:id` | Ver con equipos | admin/docente |
| POST | `/api/alumnos` | Crear registro de alumno | admin/docente |
| PUT | `/api/alumnos/:id` | Actualizar | admin/docente |
| DELETE | `/api/alumnos/:id` | Eliminar | admin |

**POST body:**
```json
{
  "matricula": "A230001",
  "nombre": "María",
  "apellido": "García",
  "email": "maria@gmail.com",
  "id_usuario": "uuid-opcional-si-ya-tiene-cuenta"
}
```

### Equipos

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/equipos` | Listar (`?id_grupo=1`) | todos |
| GET | `/api/equipos/:id` | Ver con miembros y exposiciones | todos |
| POST | `/api/equipos` | Crear (opcionalmente con alumnos) | admin/docente |
| PUT | `/api/equipos/:id` | Actualizar | admin/docente |
| DELETE | `/api/equipos/:id` | Eliminar | admin |
| POST | `/api/equipos/:id/alumnos` | Agregar alumnos al equipo | admin/docente |
| DELETE | `/api/equipos/:id/alumnos/:alumnoId` | Remover alumno del equipo | admin/docente |

**POST body (crear equipo):**
```json
{
  "nombre_equipo": "Equipo 1",
  "id_grupo": 1,
  "alumno_ids": [1, 2, 3]
}
```

**POST body (agregar alumnos):**
```json
{
  "alumno_ids": [4, 5]
}
```

### Criterios (Rúbrica)

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/criterios` | Listar (`?id_materia=1`) | todos |
| GET | `/api/criterios/:id` | Ver uno | todos |
| POST | `/api/criterios` | Crear criterio | admin/docente |
| PUT | `/api/criterios/:id` | Actualizar | admin/docente |
| DELETE | `/api/criterios/:id` | Eliminar | admin |

**POST body:**
```json
{
  "nombre_criterio": "Dominio del tema",
  "descripcion": "El equipo demuestra conocimiento profundo del tema.",
  "peso": 30,
  "id_materia": 1
}
```

> La suma de pesos de los criterios de una materia debería sumar 100.

### Exposiciones

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/exposiciones` | Listar (`?id_equipo=1&id_grupo=1`) | todos |
| GET | `/api/exposiciones/:id` | Ver con evaluaciones | todos |
| POST | `/api/exposiciones` | Crear | admin/docente |
| PUT | `/api/exposiciones/:id` | Actualizar | admin/docente |
| DELETE | `/api/exposiciones/:id` | Eliminar | admin |

**POST body:**
```json
{
  "titulo": "Patrones de diseño en POO",
  "fecha_exposicion": "2025-04-10T10:00:00Z",
  "id_equipo": 1,
  "rubrica": null
}
```

### Evaluaciones

| Método | Endpoint | Descripción | Rol |
|---|---|---|---|
| GET | `/api/evaluaciones` | Listar (`?id_exposicion=1`) | todos (alumno: solo propias) |
| GET | `/api/evaluaciones/:id` | Ver con detalle | todos |
| GET | `/api/evaluaciones/resumen/:id_exposicion` | Promedio ponderado por criterio | admin/docente |
| POST | `/api/evaluaciones` | Crear evaluación completa | todos |
| PUT | `/api/evaluaciones/:id` | Actualizar comentario | todos |
| PUT | `/api/evaluaciones/:id/detalle/:id_criterio` | Actualizar calificación de criterio | todos |
| DELETE | `/api/evaluaciones/:id` | Eliminar | admin/docente |

**POST body (crear evaluación completa):**
```json
{
  "id_exposicion": 1,
  "id_alumno_evaluador": 2,
  "comentario_general": "Buena presentación, faltó profundidad en ejemplos.",
  "calificaciones": [
    { "id_criterio": 1, "calificacion": 8.5 },
    { "id_criterio": 2, "calificacion": 7.0 },
    { "id_criterio": 3, "calificacion": 9.0 }
  ]
}
```

---

## Estructura del proyecto

```
exposcalif-backend/
├── src/
│   ├── config/
│   │   └── supabase.js       # Clientes de Supabase (admin + user)
│   ├── middleware/
│   │   └── auth.js           # authenticate + authorize
│   ├── routes/
│   │   ├── auth.js
│   │   ├── usuarios.js
│   │   ├── materias.js
│   │   ├── grupos.js
│   │   ├── alumnos.js
│   │   ├── equipos.js
│   │   ├── exposiciones.js
│   │   ├── criterios.js
│   │   └── evaluaciones.js
│   └── index.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
