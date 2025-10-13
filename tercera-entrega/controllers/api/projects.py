import requests
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

projects_api_bp = Blueprint("projects_api_bp", __name__, url_prefix="/projects")

@projects_api_bp.route("/protected", methods=["get"])
@jwt_required()
def protected():
    """
    Protected endpoint
    ---
    tags:
      - projects
    security:
      - BearerAuth: []
    responses:
      200:
        description: Returns the current logged user identity.
        schema:
          type: object
          properties:
            logged_in_as:
              type: string
              example: walter.bates
      401:
        description: Missing or invalid Authorization header
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Missing Authorization Header
    """
    current_user = get_jwt_identity()
    return jsonify(logged_in_as=current_user), 200