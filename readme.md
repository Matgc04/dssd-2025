# DSSD 2025 - Sistema de Gestión de Proyectos

Sistema web desarrollado con Next.js para la gestión de proyectos de ONGs, con integración a Bonita BPM y base de datos PostgreSQL.

## 🚀 Características

- **Frontend**: Next.js 15 con React 19
- **Base de datos**: PostgreSQL con Prisma ORM
- **Integración BPM**: Bonita Platform
- **Formularios**: React Hook Form con validación Yup
- **Estilos**: CSS Modules

## 📋 Prerrequisitos

- Node.js 18+ 
- Docker (para PostgreSQL)
- Git

## 🛠️ Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/Matgc04/dssd-2025.git
cd dssd-2025
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y configura las variables:

```bash
copy .env.example .env
```

Edita el archivo `.env` con tus configuraciones específicas.

### 4. Configurar base de datos PostgreSQL

#### Opción A: Usando Docker (Recomendado)

```bash
# Ejecutar PostgreSQL en Docker
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dssd \
  -p 5432:5432 \
  -d postgres:15

# Verificar que el contenedor esté ejecutándose
docker ps
```

#### Opción B: PostgreSQL local

Si prefieres instalar PostgreSQL localmente:
1. Descarga e instala PostgreSQL desde [postgresql.org](https://www.postgresql.org/download/)
2. Crea una base de datos llamada `dssd`
3. Ajusta la URL de conexión en `.env`

### 5. Configurar la base de datos con Prisma

```bash
# Crear las tablas en la base de datos
npx prisma db push

# Generar el cliente de Prisma
npx prisma generate
```

### 6. Ejecutar el proyecto

```bash
# Modo desarrollo
npm run dev

# El proyecto estará disponible en http://localhost:3000
```

## 🔧 Scripts disponibles

```bash
# Desarrollo
npm run dev          # Inicia el servidor de desarrollo

# Construcción
npm run build        # Construye la aplicación para producción
npm run start        # Inicia la aplicación en modo producción

# Base de datos
npm run db:generate  # Genera el cliente de Prisma
npm run db:migrate   # Ejecuta migraciones de base de datos
npm run db:studio    # Abre Prisma Studio (GUI para ver datos)

# Calidad de código
npm run lint         # Ejecuta ESLint
```

## 🗄️ Gestión de base de datos

### Ver datos con Prisma Studio

```bash
npm run db:studio
```

Esto abrirá una interfaz gráfica en `http://localhost:5555` donde puedes ver y editar los datos de la base de datos.

### Comandos útiles de Docker

```bash
# Ver contenedores ejecutándose
docker ps

# Detener el contenedor de PostgreSQL
docker stop postgres-dev

# Iniciar el contenedor de PostgreSQL
docker start postgres-dev

# Ver registros del contenedor
docker logs postgres-dev

# Conectarse directamente a PostgreSQL
docker exec -it postgres-dev psql -U postgres -d dssd
```

## 📊 Estructura del proyecto

```
dssd-2025/
├── app/                    # Rutas y páginas de Next.js
│   ├── api/               # API routes
│   ├── login/             # Página de login
│   └── projects/          # Páginas de proyectos
├── components/            # Componentes reutilizables
│   └── projects/          # Componentes específicos de proyectos
├── lib/                   # Librerías y utilidades
│   ├── generated/         # Cliente de Prisma generado
│   ├── validation/        # Esquemas de validación
│   ├── bonita.js         # Integración con Bonita
│   ├── prisma.js         # Cliente de Prisma
│   ├── projectMapper.js  # Transformación de datos
│   └── projectService.js # Servicios de proyectos
├── prisma/               # Configuración de Prisma
│   └── schema.prisma     # Esquema de base de datos
└── package.json
```

## 🔌 Integración con Bonita

El sistema se integra con Bonita BPM para la gestión de procesos. Las configuraciones de Bonita se encuentran en `lib/bonita.js`.

**Nota**: La integración con Bonita es opcional. El sistema puede funcionar guardando solo los proyectos en la base de datos sin procesar workflows.

## 🐛 Solución de problemas

### Error de conexión a la base de datos

1. Verifica que Docker esté ejecutándose: `docker ps`
2. Verifica que el puerto 5432 no esté ocupado
3. Revisa la URL de conexión en `.env`

### Error al generar cliente de Prisma

1. Cierra el servidor de desarrollo: `Ctrl+C`
2. Ejecuta: `npx prisma generate`
3. Vuelve a iniciar: `npm run dev`

### Puerto 3000 ocupado

Si el puerto 3000 está ocupado, Next.js automáticamente usará el siguiente puerto disponible (3001, 3002, etc.).

## 📝 Variables de entorno

Ver `.env.example` para todas las variables disponibles y sus descripciones.

## 🤝 Contribución

1. Bifurcar el proyecto (Fork)
2. Crear una rama para tu funcionalidad (`git checkout -b funcionalidad/nueva-funcionalidad`)
3. Confirmar cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Subir a la rama (`git push origin funcionalidad/nueva-funcionalidad`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto es para fines académicos - DSSD 2025.
