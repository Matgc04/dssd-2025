from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from core.module.projects.repository import ProjectRepository
from core.module.users.model import UserRole

projects_api_bp = Blueprint("projects_api_bp", __name__, url_prefix="/projects")


@projects_api_bp.route("/registrarPedidoAyuda", methods=["POST"])
@jwt_required()
def registrarPedidoAyuda():
    """
    Registrar pedido de ayuda
    ---
    tags:
      - projects
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
          required: [projectId, orgId, stages]
          properties:
            projectId:
              type: string
              description: Identificador del proyecto en la nube.
            orgId:
              type: string
              description: Identificador de la organización que crea el pedido.
            stages:
              type: array
              description: Lista de etapas que requieren ayuda.
              items:
                type: object
                required: [id, requests]
                properties:
                  id:
                    type: string
                    description: Identificador de la etapa del proyecto.
                  name:
                    type: string
                    description: Nombre de la etapa (opcional si la etapa ya existe).
                  description:
                    type: string
                  startDate:
                    type: string
                    format: date
                  endDate:
                    type: string
                    format: date
                  order:
                    type: integer
                    description: Orden en que se ejecuta la etapa.
                  requests:
                    type: array
                    items:
                      type: object
                      required: [id, type, description]
                      properties:
                        id:
                          type: string
                          description: Identificador del pedido.
                        type:
                          type: string
                          enum: [economic, materials, labor, other]
                        description:
                          type: string
                        amount:
                          type: number
                          format: float
                        currency:
                          type: string
                        quantity:
                          type: number
                          format: float
                        unit:
                          type: string
                        order:
                          type: integer
    responses:
      200:
        description: Pedido de ayuda creado para un proyecto nuevo en la nube.
        schema:
          type: object
          properties:
            projectId:
              type: string
            orgId:
              type: string
            stages:
              type: array
              items:
                type: object
      403:
        description: El usuario no posee el rol autorizado para registrar pedidos.
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Rol ONG colaboradora requerido
      400:
        description: Error de validación en la carga del pedido.
        schema:
          type: object
          properties:
            msg:
              type: string
    """
    claims = get_jwt()
    role = claims.get("role")
    if role != UserRole.ONG_COLABORADORA.value:
        return jsonify({"msg": "Rol ONG colaboradora requerido"}), 403

    payload = request.get_json(silent=True) or {}

    project_id = payload.get("projectId") or payload.get("project_id")
    org_id = payload.get("orgId") or payload.get("org_id")
    stages_payload = payload.get("stages")

    if not project_id or not org_id or stages_payload is None:
        return jsonify({"msg": "projectId, orgId y stages son obligatorios"}), 400

    if not isinstance(stages_payload, list):
        return jsonify({"msg": "stages debe ser una lista"}), 400

    stages_with_requests = []
    for index, stage_data in enumerate(stages_payload, start=1):
        if not isinstance(stage_data, dict):
            return jsonify({"msg": f"Stage en posición {index} debe ser un diccionario"}), 400

        requests_data = stage_data.get("requests") or []
        if not isinstance(requests_data, list):
            return jsonify({"msg": f"Requests para stage {index} debe ser una lista"}), 400

        filtered_requests = []
        for req_index, request_data in enumerate(requests_data, start=1):
            if not isinstance(request_data, dict):
                return jsonify(
                    {"msg": f"Request #{req_index} en stage {index} debe ser un diccionario"}
                ), 400
            if not request_data.get("type") or not request_data.get("description") or not request_data.get("id"):
                continue
            filtered_requests.append(request_data)

        if not filtered_requests:
            continue

        if not stage_data.get("id"):
            return jsonify(
                {"msg": f"Stage en posición {index} requiere un id si tiene pedidos"}
            ), 400

        stage_copy = dict(stage_data)
        stage_copy["requests"] = filtered_requests
        stages_with_requests.append(stage_copy)

    if not stages_with_requests:
        return jsonify({"msg": "No se enviaron etapas con pedidos válidos"}), 400

    repo = ProjectRepository()
    try:
        project = repo.upsert_project_with_requests(
            project_id=project_id,
            created_by_org_id=org_id,
            stages_payload=stages_with_requests,
        )
    except ValueError as exc:
        repo.session.rollback()
        return jsonify({"msg": str(exc)}), 400
    except Exception:
        repo.session.rollback()
        raise

    if project is None:
        return jsonify({"msg": f"El proyecto con id {project_id} ya existe"}), 400

    response_body = _serialize_project(project)
    status_code = 200
    return jsonify(response_body), status_code


def _serialize_project(project):
    return {
        "projectId": project.id,
        "orgId": project.created_by_org_id,
        "createdAt": project.created_at.isoformat() if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
        "stages": [_serialize_stage(stage) for stage in project.stages],
    }


def _serialize_stage(stage):
    return {
        "id": stage.id,
        "name": stage.name,
        "description": stage.description,
        "startDate": stage.start_date.isoformat() if stage.start_date else None,
        "endDate": stage.end_date.isoformat() if stage.end_date else None,
        "order": stage.order,
        "requests": [_serialize_request(request) for request in stage.requests],
        "createdAt": stage.created_at.isoformat() if stage.created_at else None,
        "updatedAt": stage.updated_at.isoformat() if stage.updated_at else None,
    }


def _serialize_request(request):
    amount = (
        float(request.amount) if request.amount is not None else None
    )
    quantity = (
        float(request.quantity) if request.quantity is not None else None
    )
    return {
        "id": request.id,
        "type": request.request_type.value,
        "description": request.description,
        "amount": amount,
        "currency": request.currency,
        "quantity": quantity,
        "unit": request.unit,
        "order": request.order,
        "isComplete": request.is_complete,
        "createdAt": request.created_at.isoformat() if request.created_at else None,
        "updatedAt": request.updated_at.isoformat() if request.updated_at else None,
    }
