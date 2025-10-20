  # Instalación de dependencias
Python y poetry tienen que estar instalados.

Luego, correr:
 poetry install
 
 # Variables de entorno
 cp .env.example .env

 Editar el archivo .env y setear las variables de entorno necesarias.
 
 # Correr la aplicación
 poetry run python main.py
 
 La api va a estar corriendo en http://localhost:5000/api/v1/

 La documentación de la API va a estar en http://localhost:5000/apidocs/

# Inicializar la base de datos
En development correr:

**IMPORTANTE:** Antes de usar los comandos de flask, asegurate de setear la variable de entorno `FLASK_APP` para que Flask CLI encuentre la app:

En PowerShell (Windows):
```powershell
$env:FLASK_APP = "main:app"
poetry run flask reset-db
poetry run flask seed-db
```

En bash (Linux/macOS):
```bash
export FLASK_APP=main:app
poetry run flask reset-db
poetry run flask seed-db
```

Esto crea las tablas en la base de datos y el seed pone algunos usuarios de ejemplo.

# Usar swagger
 Para testear el login (luego de hacer el seed)
 <br/>
    - username: admin
    - password: admin123
  Este usuario es sysadmin y puede crear otros usuarios.

    - username: demo{1,2,3,4}
    - password: demo123
  Usuario sin sysadmin, tiene los distintos roles.

El login devuelve un jwt que se puede usar para las rutas protegidas.

Para pegar el jwt en Swagger en rutas protegidas, hacer click en el boton de authorize con un candado de la derecha e ingresar:
    Bearer token_jwt
    (token_jwt es el token que devuelve el login, sin las comillas)

Hacer click en authorize y luego en close. Luego probar las rutas protegidas.