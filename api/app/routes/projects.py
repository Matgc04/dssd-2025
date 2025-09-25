from flask import Blueprint, jsonify, request
from app.services.bonita import Bonita

bp = Blueprint('projects', __name__)
bonita = Bonita()


@bp.post('/projects')
def create_project():
    data = request.json
    client_name = data.get('createdByOrgId')
    pedidos_totales = data.get('requests', 0)

    if not all([client_name, pedidos_totales]):
        return jsonify({"error": "Missing required fields"}), 400

    variables = [
        {"name": "id", "value": client_name, "type": "String"},
        {"name": "pedidosTotales", "value": pedidos_totales, "type": "Integer"},
        {"name": "pedidosActuales", "value": 0, "type": "Integer"},
    ]

    try:
        case_id = bonita.start_case(variables)
        return jsonify({"caseId": case_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500