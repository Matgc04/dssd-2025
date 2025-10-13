import requests
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token

auth_api_bp = Blueprint("auth_api_bp", __name__, url_prefix="/auth")

@auth_api_bp.route("/login", methods=["POST"])
def login():
    """
    User login
    ---
    tags:
      - auth
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [username, password]
          properties:
            username:
              type: string
              example: walter.bates
            password:
              type: string
              example: bpm
    responses:
      200:
        description: JWT issued
        schema:
          type: object
          properties:
            access_token:
              type: string
              example: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
      401:
        description: Bad credentials
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Bad username or password
    """
    username = request.json.get("username", None)
    password = request.json.get("password", None)
    if username != "walter.bates" or password != "bpm":
        return jsonify({"msg": "Bad username or password"}), 401

    access_token = create_access_token(identity=username)
    return jsonify(access_token=access_token)
