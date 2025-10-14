from __future__ import annotations

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

swagger_template = {
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: 'Bearer <access_token>'"
        }
    }
}

swagger = Swagger(app, template=swagger_template)
app.config.from_object(config["development"]) # TODO: make it dynamic

jwt = JWTManager(app)
db.init_app(app)

app.register_blueprint(api_bp)
register_commands(app)


if __name__ == "__main__":
    app.run(debug=True)
