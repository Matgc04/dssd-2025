from flask import Flask
from flasgger import Swagger
from flask_jwt_extended import JWTManager
from core.config import config
from controllers.api import api_bp

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
app.register_blueprint(api_bp)


if __name__ == "__main__":
    app.run(debug=True)