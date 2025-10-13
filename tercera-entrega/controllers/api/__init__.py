from flask import Blueprint
from . import auth, projects
from .projects import projects_api_bp
from .auth import auth_api_bp

api_bp = Blueprint("api_bp", import_name="api_bp", url_prefix="/api/v1")
api_bp.register_blueprint(auth_api_bp)
api_bp.register_blueprint(projects_api_bp)

__all__ = [
    "auth",
    "projects",
    "projects_api_bp",
    "auth_api_bp",
    "api_bp"
]