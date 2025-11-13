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

### Si usaste esta opcion antes y el contenedor ya existe, inicia el contenedor con:

```bash
docker start postgres-dev
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

## 🗄️ Gestión de base de datos

### Ver datos con Prisma Studio

```bash
npm run db:studio
```

Esto abrirá una interfaz gráfica en `http://localhost:5555` donde puedes ver y editar los datos de la base de datos.

## 📊 Estructura del proyecto

```
dssd-2025/
├── app/                    # Rutas y páginas de Next.js
│   ├── api/               # API routes
│   ├── login/             # Página de login
│   ├── projects/          # Páginas de proyectos
│   └── forbidden/          # Página 403
├── components/            # Componentes reutilizables
│   └── projects/          # Componentes específicos de proyectos
├── lib/                   # Librerías y utilidades
│   ├── generated/         # Cliente de Prisma generado
│   ├── validation/        # Esquemas de validación
│   ├── bonita.js         # Integración con Bonita
│   ├── prisma.js         # Cliente de Prisma
│   ├── auth.js         # Metodo para obtener sesion del usuario
│   ├── constants.js      # Constantes del proyecto
│   ├── projectMapper.js  # Transformación de datos
│   └── projectService.js # Servicios de proyectos
├── prisma/               # Configuración de Prisma
│   └── schema.prisma     # Esquema de base de datos
└── package.json
```

## 🔌 Integración con Bonita

El sistema se integra con Bonita BPM para la gestión de procesos. Las configuraciones de Bonita se encuentran en `lib/bonita.js`.


## Usuarios y Roles de Prueba
Usuario rol miembro: walter.bates bpm
Usuario con rol ONG originante: ongColaboradora1 bpm
Usuario con rol Red ONG: redOng1 bpm
Usuario con rol Consejo Directivo: consejoDirectivo1 bpm

Los roles están definidos en `lib/constants.js` y en el proyecto de bonita (ver main).
