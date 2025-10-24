from __future__ import annotations

import os
import sys
from pathlib import Path

from flask import Flask
from flasgger import Swagger
from flask_jwt_extended import JWTManager


BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


from core.config import config  # noqa: E402
from controllers.api import api_bp  # noqa: E402
from core import database as db  # noqa: E402
from core.commands import register_commands  # noqa: E402

app = Flask(__name__)

register_commands(app)

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "DSSD TP API",
        "version": "0.1.0",
        "description": "API para gestionar usuarios y pedidos de ayuda de proyectos.",
    },
    "tags": [
        {"name": "auth", "description": "Endpoints de autenticación y administración de usuarios."},
    ],
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: 'Bearer <access_token>'",
        }
    },
}

swagger = Swagger(app, template=swagger_template)

config_name = (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development").lower()
app_config = config.get(config_name, config["development"])
app.config.from_object(app_config)

jwt = JWTManager(app)
db.init_app(app)

app.register_blueprint(api_bp)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=app.config.get("DEBUG", False),
    )
