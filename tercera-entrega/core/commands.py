import json
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import select

from core import database

def register_commands(app):
    """
    Register custom CLI commands for the Flask application.

    This function adds custom commands to the Flask CLI, such as resetting
    and seeding the database.

    Args:
        app (Flask): The Flask application instance.
    """
    @app.cli.command(name="reset-db")
    def reset_db():
        """
        Reset the database.

        This command drops all tables in the database and recreates them.
        """
        database.reset(app)

    @app.cli.command(name="seed-db")
    def seed_db():
        """
        Seed the database.

        This command populates the database with initial data.
        """
        from core.seed import seed_all

        seed_all(app)

    @app.cli.command(name="dump-all")
    def dump_all():
        """
        Dump every entity grouped by type (users, projects, stages, requests, collaborations).
        Useful for quick debugging in non-production environments.
        """
        from core.module.users.model import User
        from core.module.projects.model import Project, Stage, StageRequest, StageRequestCollaboration

        def _fmt(value):
            if isinstance(value, Enum):
                return value.value
            if isinstance(value, (datetime, date)):
                return value.isoformat()
            if isinstance(value, Decimal):
                return float(value)
            return value

        def _serialize(obj, fields):
            return {field: _fmt(getattr(obj, field)) for field in fields}

        def _print_section(title, rows):
            print(f"\n== {title} ({len(rows)}) ==")
            if not rows:
                print("  (sin datos)")
                return
            print(json.dumps(rows, indent=2, ensure_ascii=True))

        session = database.db.session

        users = session.execute(select(User).order_by(User.id)).scalars().all()
        projects = session.execute(select(Project).order_by(Project.created_at)).scalars().all()
        stages = session.execute(select(Stage).order_by(Stage.project_id, Stage.order)).scalars().all()
        stage_requests = session.execute(
            select(StageRequest).order_by(StageRequest.project_id, StageRequest.stage_id, StageRequest.order)
        ).scalars().all()
        collaborations = session.execute(
            select(StageRequestCollaboration).order_by(StageRequestCollaboration.created_at)
        ).scalars().all()

        _print_section(
            "Users",
            [
                _serialize(
                    user,
                    [
                        "id",
                        "username",
                        "email",
                        "role",
                        "is_sysadmin",
                        "is_active",
                        "created_at",
                        "updated_at",
                        "deleted_at",
                    ],
                )
                for user in users
            ],
        )

        _print_section(
            "Projects",
            [
                _serialize(
                    project,
                    [
                        "id",
                        "created_by_org_id",
                        "bonita_case_id",
                        "status",
                        "created_at",
                        "updated_at",
                    ],
                )
                for project in projects
            ],
        )

        _print_section(
            "Stages",
            [
                _serialize(
                    stage,
                    [
                        "id",
                        "project_id",
                        "name",
                        "description",
                        "start_date",
                        "end_date",
                        "order",
                        "created_at",
                        "updated_at",
                    ],
                )
                for stage in stages
            ],
        )

        _print_section(
            "StageRequests",
            [
                _serialize(
                    request,
                    [
                        "id",
                        "project_id",
                        "stage_id",
                        "request_type",
                        "description",
                        "amount",
                        "currency",
                        "quantity",
                        "unit",
                        "order",
                        "is_complete",
                        "is_being_completed",
                        "created_at",
                        "updated_at",
                    ],
                )
                for request in stage_requests
            ],
        )

        _print_section(
            "StageRequestCollaborations",
            [
                _serialize(
                    collaboration,
                    [
                        "id",
                        "stage_request_id",
                        "collaborator_org_id",
                        "committed_amount",
                        "committed_quantity",
                        "commited_currency",
                        "commited_unit",
                        "created_at",
                        "updated_at",
                    ],
                )
                for collaboration in collaborations
            ],
        )
