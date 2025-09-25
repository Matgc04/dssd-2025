from flask import Flask
from flask_cors import CORS
from app.routes.projects import bp as projects_bp

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register blueprints
    app.register_blueprint(projects_bp, url_prefix='/api')

    return app