from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required, decode_token

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
      - Proyectos ONGs
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
      401:
        description: Token JWT inválido o faltante
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Missing authorization header
      403:
        description: El usuario no posee el rol autorizado para registrar pedidos.
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Rol ONG requerido
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

    if role != UserRole.ONG.value:
        return jsonify({"msg": "Rol ONG requerido"}), 403
    
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


@projects_api_bp.route("/etapas_necesitan_colaboracion", methods=["get"])
@jwt_required()
def queEtapasNecesitanColaboracion():
      """
      Obtener las etapas de un proyecto que necesitan colaboración
      ---
      tags:
        - Proyectos ONGs
      security:
      - BearerAuth: []
      parameters:
        - in: query
          name: projectId
          required: true
          schema:
            type: object
            properties:
      responses:
        200:
          description: Lista de etapas que requieren colaboración
          schema:
            type: object
            properties:
              projectId:
                type: integer
              title:
                type: string
              stages:
                type: array
                items:
                  type: object
                  properties:
                    stageId:
                      type: string
                    name:
                      type: string
        400:
          description: Parámetros inválidos
          schema:
            type: object
            properties:
              error:
                type: string
        404:
          description: Proyecto no encontrado
          schema:
            type: object
            properties:
              error:
                type: string
      """
      project_id = request.args.get("projectId") or request.args.get("project_id")
      
      if not project_id:
          return jsonify({"error": "Falta projectId"}), 400
      
      repo = ProjectRepository()
      project = repo.get_project(project_id)
      if not project:
          return jsonify({"error": "Proyecto no encontrado."}), 404
      
      stages = [{
          "stageId": stage.id,
          "name": stage.name,
      } for stage in project.stages if any(not req.is_complete and not req.is_being_completed for req in stage.requests)]
      
      return jsonify({"stages": stages}), 200

@projects_api_bp.route("/quiero_colaborar/", methods=["POST"])
def quiero_colaborar():
    """
    Expresar intención de colaborar en un pedido de ayuda
    ---
    tags:
      - Proyectos ONGs
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [jwt, project_id, stage_id, help_request_id, commited_amount, commited_quantity]
          properties:
            jwt:
              type: string
              description: JWT token requerido en el body.
            project_id:
              type: string
            stage_id:
              type: string
            help_request_id:
              type: string
            commited_amount:
              type: number
            commited_quantity:
              type: number
    responses:
      200:
        description: Intención de colaboración registrada
      401:
        description: Token JWT inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para colaborar
    """
    payload = request.get_json(silent=True) or {}
    token = payload.get("jwt")
    if not token:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    try:
        claims = decode_token(token)
    except Exception:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    role = claims.get("role")
    if role != UserRole.ONG.value:
        return jsonify({"msg": "Rol ONG requerido"}), 403

    project_id = payload.get("project_id")
    stage_id = payload.get("stage_id")
    help_request_id = payload.get("help_request_id")
    commited_amount = payload.get("commited_amount")
    commited_quantity = payload.get("commited_quantity")
    if not all([project_id, stage_id, help_request_id, commited_amount, commited_quantity]):
        return jsonify({"msg": "Faltan datos obligatorios para colaborar"}), 400

    # Implementar la lógica para registrar la colaboración
    return jsonify({"msg": "Intención de colaboración registrada"}), 200

@projects_api_bp.route("/termino_colaboracion", methods=["POST"])
def termino_colaboracion():
    """
    Completar una colaboración en un pedido de ayuda
    ---
    tags:
      - Proyectos ONGs
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [jwt, collaboration_id]
          properties:
            jwt:
              type: string
              description: JWT token requerido en el body.
            collaboration_id:
              type: string
    responses:
      200:
        description: Colaboración completada
      401:
        description: Token JWT inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para completar colaboración
    """
    payload = request.get_json(silent=True) or {}
    token = payload.get("jwt")
    if not token:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    try:
        claims = decode_token(token)
    except Exception:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    role = claims.get("role")
    if role != UserRole.ONG.value:
        return jsonify({"msg": "Rol ONG requerido"}), 403

    collaboration_id = payload.get("collaboration_id")
    if not collaboration_id:
        return jsonify({"msg": "Falta collaboration_id"}), 400

    # Implementar la lógica para completar la colaboración
    return jsonify({"msg": "Colaboración completada"}), 200

@projects_api_bp.route("/poner_observacion", methods=["POST"])
def poner_observacion():
    """
    Poner una observación en un proyecto
    ---
    tags:
      - Proyectos Consejo Directivo
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [jwt, project_id, observacion]
          properties:
            jwt:
              type: string
              description: JWT token requerido en el body.
            project_id:
              type: integer
              description: Identificador del proyecto
              example: 1
            observacion:
              type: string
              description: Texto de la observación
              example: "Necesita revisar documentación"
    responses:
      201:
        description: Observación creada exitosamente
      401:
        description: No autorizado - Token inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para poner observación
    """
    payload = request.get_json(silent=True) or {}
    token = payload.get("jwt")
    if not token:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    try:
        claims = decode_token(token)
    except Exception:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    role = claims.get("role")
    if role != UserRole.CONSEJO_DIRECTIVO.value:
        return jsonify({"msg": "Rol Consejo Directivo requerido"}), 403

    project_id = payload.get("project_id")
    observacion = payload.get("observacion")
    if not project_id or not observacion:
        return jsonify({"msg": "Faltan datos obligatorios"}), 400

    # Implementar la lógica para registrar la observación
    return jsonify({"msg": "Observación creada exitosamente"}), 201

@projects_api_bp.route("/observacion_terminada", methods=["POST"])
def observacion_terminada():
    """
    Marcar una observación como terminada
    ---
    tags:
      - Proyectos Consejo Directivo
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [jwt, observacion_id, project_id]
          properties:
            jwt:
              type: string
              description: JWT token requerido en el body.
            observacion_id:
              type: integer
              description: ID de la observación
              example: 1
            project_id:
              type: integer
              description: Identificador del proyecto
              example: 1
    responses:
      200:
        description: Observación marcada como terminada
      401:
        description: No autorizado - Token inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para terminar observación
    """
    payload = request.get_json(silent=True) or {}
    token = payload.get("jwt")
    if not token:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    try:
        claims = decode_token(token)
    except Exception:
        return jsonify({"msg": "Token JWT inválido o faltante"}), 401
    role = claims.get("role")
    if role != UserRole.CONSEJO_DIRECTIVO.value:
        return jsonify({"msg": "Rol Consejo Directivo requerido"}), 403

    observacion_id = payload.get("observacion_id")
    project_id = payload.get("project_id")
    if not observacion_id or not project_id:
        return jsonify({"msg": "Faltan datos obligatorios"}), 400

    # Implementar la lógica para marcar la observación como terminada
    return jsonify({"msg": "Observación marcada como terminada"}), 200

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

# /QuieroColaborar 
# /TerminoColaboracion
# Ver el tema de las observaciones a ver si podes meter un endpoint
# /PonerObservacion supervisor
# /ObservacionTerminada la ong originante