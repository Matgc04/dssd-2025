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

# Usar swagger
 Para testear el login, se puede usar el siguiente usuario:
 <br/>
    - username: walter.bates
    - password: bpm

Esto devuelve un jwt que se puede usar para las rutas protegidas.

Para pegar el jwt en Swagger en rutas protegidas, hacer click en el boton de authorize con un candado de la derecha e ingresar:
    Bearer token_jwt
    (token_jwt es el token que devuelve el login, sin las comillas)

Hacer click en authorize y luego en close. Luego probar las rutas protegidas.