from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required

from core.module.projects.repository import ProjectRepository
from core.module.users.model import UserRole
from core.module.projects.model import StageRequestCollaboration

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
            bonitaCaseId:
              type: string
              description: Identificador del caso en Bonita.
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

    if role not in (UserRole.ONG_ORIGINANTE.value, UserRole.BONITA.value):
        return jsonify({"msg": "Rol ONG originante requerido"}), 403
    
    payload = request.get_json(silent=True) or {}

    project_id = payload.get("projectId") or payload.get("project_id")
    org_id = payload.get("orgId") or payload.get("org_id")
    stages_payload = payload.get("stages")

    #print(f"payload recibido en registrarPedidoAyuda: {payload}")
    #print(f"project_id: {project_id}, org_id: {org_id}, stages_payload: {stages_payload}")

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
            bonita_case_id=payload.get("bonitaCaseId"),
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


@projects_api_bp.route("/etapasNecesitanColaboracion", methods=["get"])
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
              stages:
                type: array
                items:
                  type: object
                  properties:
                    stageId:
                      type: string
                    name:
                      type: string
                  requests:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        type:
                          type: string
                        description:
                          type: string
                        amount:
                          type: number
                        currency:
                          type: string
                        quantity:
                          type: number
                        unit:
                          type: string
                        order:
                          type: integer
                        isComplete:
                          type: boolean
                        isBeingCompleted:
                          type: boolean
                        createdAt:
                          type: string
                          format: date-time
                        updatedAt:
                          type: string
                          format: date-time
        400:
          description: Parámetros inválidos
          schema:
            type: object
            properties:
              error:
                type: string
        401:
          description: Token JWT inválido o faltante
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
      
      stages = []
      for stage in project.stages:
          pending_requests = [
              request
              for request in stage.requests
              if not request.is_complete and not request.is_being_completed
          ]
          if not pending_requests:
              continue

          stage_payload = _serialize_stage(stage)
          stage_payload["requests"] = [
              _serialize_request(request) for request in pending_requests
          ]
          stages.append(stage_payload)
      
      return jsonify({"stages": stages}), 200


@projects_api_bp.route("/pendientesNecesitanColaboracion", methods=["GET"])
@jwt_required()
def proyectos_pendientes_necesitan_colaboracion():
    """Listar proyectos pendientes con pedidos de ayuda sin atender.
    ---
    tags:
      - Proyectos ONGs
    security:
      - BearerAuth: []
    responses:
      200:
        description: Proyectos pendientes que todavía requieren colaboración.
        schema:
          type: object
          properties:
            projects:
              type: array
              items:
                type: object
                properties:
                  projectId:
                    type: string
                  orgId:
                    type: string
                  status:
                    type: string
                    enum: [pending, executing, completed]
                  bonitaCaseId:
                    type: string
                    nullable: true
                  createdAt:
                    type: string
                    format: date-time
                  updatedAt:
                    type: string
                    format: date-time
      401:
        description: Token JWT inválido o faltante.
      500:
        description: Error inesperado en el servidor.
    """

    repo = ProjectRepository()
    projects = repo.list_pending_projects_needing_collaboration()
    payload = {
        "projects": [_serialize_project_summary(project) for project in projects]
    }
    return jsonify(payload), 200

@projects_api_bp.route("/quieroColaborar/", methods=["POST"])
@jwt_required()
def quiero_colaborar():
    """
    Expresar intención de colaborar en un pedido de ayuda
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
          required: [org_id, project_id, stage_id, help_request_id, commited_amount, commited_quantity]
          properties:
            org_id:
              type: string
            project_id:
              type: string
            stage_id:
              type: string
            help_request_id:
              type: string
            collaboration_id:
              type: string
            commited_amount:
              type: number
            commited_quantity:
              type: number
    responses:
      200:
        description: Intención de colaboración registrada
      400:
        description: Datos de entrada inválidos o incompletos
      401:
        description: Token JWT inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para colaborar
      404:
        description: Etapa o pedido de ayuda no encontrado
      409:
        description: Pedido de ayuda ya completado o en proceso de atención
    """
    payload = request.get_json(silent=True) or {}
    claims = get_jwt()

    role = claims.get("role")
    if role not in (UserRole.RED_ONG.value, UserRole.BONITA.value):
        return jsonify({"msg": "Rol red de ONGs requerido"}), 403
    
    print(f"Payload recibido en quieroColaborar: {payload}")

    collaborator_org_id = (
      payload.get("org_id") or payload.get("orgId")
    )

    if not collaborator_org_id:
        print("No se pudo determinar la organización colaboradora")
        return jsonify({"msg": "No se pudo determinar la organización colaboradora"}), 400

    project_id = str(payload.get("project_id") or payload.get("projectId"))
    stage_id = str(payload.get("stage_id") or payload.get("stageId"))
    help_request_id = str(payload.get("help_request_id") or payload.get("helpRequestId"))
    collaboration_id = str(payload.get("collaboration_id") or payload.get("collaborationId"))

    commited_unit = payload.get("commited_unit")
    commited_quantity = payload.get("commited_quantity")

    field_labels = {
        "project_id": project_id,
        "stage_id": stage_id,
        "help_request_id": help_request_id,
        "collaboration_id": collaboration_id,
        "commited_unit": commited_unit,
        "commited_quantity": commited_quantity,
    }
    missing_fields = [name for name, value in field_labels.items() if value in (None, "")]
    if missing_fields:
        print(missing_fields)
        return (
            jsonify(
                {
                    "msg": f"Faltan datos obligatorios: {', '.join(sorted(missing_fields))}"
                }
            ),
            400,
        )

    repo = ProjectRepository()

    stage = repo.get_stage(stage_id, project_id=project_id)
    if not stage:
        return jsonify({"msg": "Etapa no encontrada"}), 404
    stage_request = repo.get_request(help_request_id)
    if (
        not stage_request
        or stage_request.stage_id != stage_id
        or stage_request.project_id != project_id
    ):
        return jsonify({"msg": "Pedido de ayuda no encontrado para la etapa indicada"}), 404
    if stage_request.is_complete:
        return jsonify({"msg": "El pedido de ayuda ya fue completado"}), 409
    if stage_request.is_being_completed:
        return jsonify({"msg": "El pedido de ayuda ya está siendo atendido"}), 409

    committed_quantity_decimal = (
        repo._coerce_decimal(commited_quantity, scale=3)
        if commited_quantity is not None
        else None
    )

    collaboration = StageRequestCollaboration(
        id=collaboration_id,
        stage_request_id=stage_request.id,
        collaborator_org_id=str(collaborator_org_id),
        committed_quantity=committed_quantity_decimal,
        commited_unit=commited_unit,
    )
    repo.session.add(collaboration)

    #stage_request.is_being_completed = True
    repo.session.add(stage_request) #ver si hace falta esto

    repo.session.commit()

    def _decimal_to_float(value):
        return float(value) if value is not None else None

    response_payload = {
        "msg": "Intención de colaboración registrada",
        "collaboration": {
            "id": collaboration.id,
            "project_id": project_id,
            "stage_id": stage_id,
            "stage_request_id": stage_request.id,
            "collaborator_org_id": collaborator_org_id,
            "committed_unit": collaboration.commited_unit,
            "committed_quantity": _decimal_to_float(collaboration.committed_quantity),
        },
    }

    print(f"Response payload en quieroColaborar: {response_payload}")
    return jsonify(response_payload), 200

@projects_api_bp.route("/aceptaColaboracion", methods=["PATCH"])
@jwt_required()
def acepta_colaboracion():
    """
    Aceptar o rechazar una colaboración para un pedido de ayuda
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
          required: [projectId, requestId, collaborationId, accepted]
          properties:
            projectId:
              type: string
            requestId:
              type: string
            collaborationId:
              type: string
            accepted:
              type: boolean
              description: Indica si la ONG originante acepta la colaboración.
    responses:
      200:
        description: Estado de colaboración actualizado
      400:
        description: Datos faltantes o inválidos
      401:
        description: Token JWT inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para aceptar colaboraciones
      404:
        description: Colaboración o pedido de ayuda no encontrado
      409:
        description: El pedido de ayuda ya fue completado
    """
    payload = request.get_json(silent=True) or {}
    claims = get_jwt()
    role = claims.get("role")
    if role not in (UserRole.ONG_ORIGINANTE.value, UserRole.BONITA.value):
        return jsonify({"msg": "Rol ONG originante requerido"}), 403

    project_id_raw = payload.get("projectId") or payload.get("project_id")
    request_id_raw = payload.get("requestId") or payload.get("request_id")
    collaboration_id_raw = payload.get("collaborationId") or payload.get("collaboration_id")
    accepted_raw = payload.get("accepted")

    print(f"Payload recibido en aceptaColaboracion: {payload}")

    missing_fields = [
        name
        for name, value in {
            "projectId": project_id_raw,
            "requestId": request_id_raw,
            "collaborationId": collaboration_id_raw,
            "accepted": accepted_raw if accepted_raw is not None else None,
        }.items()
        if value in (None, "")
    ]
    if missing_fields:
        return jsonify({"msg": f"Faltan datos obligatorios: {', '.join(sorted(missing_fields))}"}), 400

    repo = ProjectRepository()
    try:
        accepted = repo._coerce_bool(accepted_raw)
    except ValueError:
        return jsonify({"msg": "El campo accepted debe ser booleano"}), 400

    try:
        stage_request = repo.set_collaboration_acceptance(
            project_id=str(project_id_raw),
            request_id=str(request_id_raw),
            collaboration_id=str(collaboration_id_raw),
            accepted=accepted,
        )
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400
    except LookupError as exc:
        print(f"Error de lookup en aceptaColaboracion: {exc}")
        return jsonify({"msg": str(exc)}), 404
    except RuntimeError as exc:
        return jsonify({"msg": str(exc)}), 409

    return (
        jsonify(
            {
                "msg": "Estado de colaboración actualizado",
                "accepted": stage_request.is_being_completed,
                "request": {
                    "id": stage_request.id,
                    "project_id": stage_request.project_id,
                    "stage_id": stage_request.stage_id,
                    "is_complete": stage_request.is_complete,
                    "is_being_completed": stage_request.is_being_completed,
                },
                "collaboration_id": str(collaboration_id_raw),
            }
        ),
        200,
    )

@projects_api_bp.route("/terminoColaboracion", methods=["POST"])
@jwt_required()
def termino_colaboracion():
    """
    Completar una colaboración en un pedido de ayuda
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
          required: [collaboration_id]
          properties:
            collaboration_id:
              type: string
    responses:
      200:
        description: Colaboración completada
      400:
        description: Falta collaboration_id
      401:
        description: Token JWT inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para completar colaboración
      404:
        description: Colaboración no encontrada
      409:
        description: La colaboración ya fue completada
    """
    payload = request.get_json(silent=True) or {}
    
    claims = get_jwt()
    role = claims.get("role")
    if role not in (UserRole.ONG_ORIGINANTE.value, UserRole.RED_ONG.value, UserRole.BONITA.value):
        return jsonify({"msg": "Rol ONG originante o rol red de ongs requerido"}), 403 #no se cual rol deberia ser el correcto lo dejo asi por ahora

    collaboration_id = payload.get("collaboration_id")
    if not collaboration_id:
        return jsonify({"msg": "Falta collaboration_id"}), 400

    repo = ProjectRepository()
    try:
        repo.complete_collaboration(str(collaboration_id))
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400
    except LookupError as exc:
        return jsonify({"msg": "No se encontró la colaboración"}), 404
    except RuntimeError as exc:
        return jsonify({"msg": "La colaboración ya fue completada"}), 409
    
    return jsonify({"msg": "Colaboración completada"}), 200

@projects_api_bp.route("/hacerObservacion", methods=["POST"])
@jwt_required()
def hacer_observacion():
    """
    Crear una observación en un proyecto
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
          required: [observationId, projectId, content]
          properties:
            observationId:
              type: string
              description: Identificador de la observación provisto por la nube.
            projectId:
              type: string
              description: Identificador del proyecto.
            content:
              type: string
              description: Contenido de la observación a registrar.
    responses:
      201:
        description: Observación creada exitosamente.
        schema:
          type: object
          properties:
            msg:
              type: string
            observation:
              type: object
              properties:
                id:
                  type: string
                projectId:
                  type: string
                content:
                  type: string
                isCompleted:
                  type: boolean
                createdAt:
                  type: string
                  format: date-time
                updatedAt:
                  type: string
                  format: date-time
      400:
        description: Datos faltantes o inválidos.
        schema:
          type: object
          properties:
            msg:
              type: string
      401:
        description: Token JWT inválido o faltante.
      403:
        description: El usuario no posee el rol autorizado para crear observaciones.
      404:
        description: Proyecto no encontrado.
    """
    payload = request.get_json(silent=True) or {}

    claims = get_jwt()
    role = claims.get("role")
    if role not in (UserRole.CONSEJO_DIRECTIVO.value, UserRole.BONITA.value):
        return jsonify({"msg": "Rol Consejo Directivo requerido"}), 403

    observation_id = payload.get("observationId") or payload.get("observation_id")
    project_id = payload.get("projectId") or payload.get("project_id")
    content = payload.get("content")

    if isinstance(observation_id, str):
        observation_id = observation_id.strip()
    if isinstance(project_id, str):
        project_id = project_id.strip()
    if isinstance(content, str):
        content = content.strip()

    if not observation_id or not project_id or not content:
        return jsonify({"msg": "observationId, projectId y content son obligatorios"}), 400

    repo = ProjectRepository()
    try:
        observation = repo.create_observation(
            observation_id=observation_id,
            project_id=str(project_id),
            content=content,
            is_completed=False,
        )
    except LookupError:
        print(f"Proyecto con id {project_id} no encontrado al crear observación")
        return jsonify({"msg": "Proyecto no encontrado"}), 404
    except ValueError as exc:
        print(f"Error al crear observación: {exc}")
        return jsonify({"msg": str(exc)}), 400

    return (
        jsonify(
            {
                "msg": "Observación creada",
                "observation": _serialize_observation(observation),
            }
        ),
        201,
    )

@projects_api_bp.route("/completarObservacion", methods=["PATCH"])
@jwt_required()
def completar_observacion():
    """
    Marcar una observación como completada
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
          required: [observationId]
          properties:
            observationId:
              type: string
              description: Identificador de la observación a completar.
    responses:
      200:
        description: Observación marcada como completada
      400:
        description: Datos faltantes o inválidos
      401:
        description: Token JWT inválido o faltante
      403:
        description: El usuario no posee el rol autorizado para completar observaciones
      404:
        description: Observación no encontrada
    """
    payload = request.get_json(silent=True) or {}

    claims = get_jwt()
    role = claims.get("role")
    if role not in (UserRole.ONG_ORIGINANTE.value, UserRole.BONITA.value):
        return jsonify({"msg": "Rol ONG originante requerido"}), 403

    observation_id = payload.get("observationId") or payload.get("observation_id")
    if isinstance(observation_id, str):
        observation_id = observation_id.strip()

    if not observation_id:
        return jsonify({"msg": "observationId es obligatorio"}), 400

    repo = ProjectRepository()
    try:
        observation = repo.complete_observation(str(observation_id))
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400
    except LookupError:
        print(f"Observación con id {observation_id} no encontrada al completar")
        return jsonify({"msg": "Observación no encontrada"}), 404

    return (
        jsonify(
            {
                "msg": "Observación completada",
                "observation": _serialize_observation(observation),
            }
        ),
        200,
    )

def _serialize_observation(observation):
    return {
        "id": observation.id,
        "projectId": observation.project_id,
        "content": observation.content,
        "isCompleted": observation.is_completed,
        "createdAt": observation.created_at.isoformat() if observation.created_at else None,
        "updatedAt": observation.updated_at.isoformat() if observation.updated_at else None,
    }

def _serialize_project(project):
    return {
        "projectId": project.id,
        "orgId": project.created_by_org_id,
        "createdAt": project.created_at.isoformat() if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
        "stages": [_serialize_stage(stage) for stage in project.stages],
    }


def _serialize_project_summary(project):
    return {
        "projectId": project.id,
        "orgId": project.created_by_org_id,
        "status": project.status.value,
        "bonitaCaseId": project.bonita_case_id,
        "createdAt": project.created_at.isoformat() if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() if project.updated_at else None,
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
        "isBeingCompleted": request.is_being_completed,
        "createdAt": request.created_at.isoformat() if request.created_at else None,
        "updatedAt": request.updated_at.isoformat() if request.updated_at else None,
    }

# /QuieroColaborar 
# /TerminoColaboracion
# Ver el tema de las observaciones a ver si podes meter un endpoint
# /PonerObservacion supervisor
# /ObservacionTerminada la ong originante
