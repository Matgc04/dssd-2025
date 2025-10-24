from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from core.module.users.model import UserRole
from core.module.users.repository import UserRepository

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
              example: demo2
            password:
              type: string
              example: demo123
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
    payload = request.get_json(silent=True) or {}
    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        return jsonify({"msg": "Username and password are required"}), 400

    repo = UserRepository()
    user = repo.get_by_username(username)
    if (
        not user
        or user.deleted_at is not None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"msg": "Bad username or password"}), 401

    access_token = create_access_token(
        identity=user.username,
        additional_claims={"role": user.role.value},
    )
    return jsonify(access_token=access_token), 200



@auth_api_bp.route("/users", methods=["POST"])
@jwt_required()
def create_user():
    """
    Create a new user (sysadmin only)
    ---
    tags:
      - auth
    security:
      - BearerAuth: []
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [username, password, email]
          properties:
            username:
              type: string
              example: new.user
            password:
              type: string
              example: secret123
            email:
              type: string
              example: new.user@example.com
            role:
              type: string
              example: ONG
            is_sysadmin:
              type: boolean
              example: False
    responses:
      201:
        description: User created
        schema:
          type: object
          properties:
            id:
              type: integer
            username:
              type: string
            email:
              type: string
            role:
              type: string
            is_sysadmin:
              type: boolean
      400:
        description: Invalid payload
      401:
        description: Missing or invalid Authorization header
      403:
        description: Sysadmin privileges required
      409:
        description: Duplicate username or email
    """
    payload = request.get_json(silent=True) or {}
    username = payload.get("username")
    password = payload.get("password")
    email = payload.get("email")
    role = payload.get("role", UserRole.SIN_DEFINIR.value)
    is_sysadmin = bool(payload.get("is_sysadmin", False))

    if not username or not password or not email:
        return jsonify({"msg": "Username, password, and email are required"}), 400
    
      # Require sysadmin JWT in header
    requester_username = get_jwt_identity()

    repo = UserRepository()
    requester = repo.get_by_username(requester_username)
    if (
        not requester
        or requester.deleted_at is not None
        or not requester.is_active
        or not requester.is_sysadmin
    ):
        return jsonify({"msg": "Not authorized to access this page"}), 401

    password_hash = generate_password_hash(password)
    try:
        user = repo.create(
            username=username,
            password_hash=password_hash,
            email=email,
            is_sysadmin=is_sysadmin,
            role=role,
        )
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400
    except IntegrityError:
        repo.session.rollback()
        return jsonify({"msg": "Username or email already exists"}), 409

    return (
        jsonify(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "is_sysadmin": user.is_sysadmin,
            }
        ),
        201,
    )
