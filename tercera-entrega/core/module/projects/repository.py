from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable, Optional, Union

from sqlalchemy import select
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from core.database import db
from .model import Project, RequestType, Stage, StageRequest, StageRequestCollaboration


class ProjectRepository:
    def __init__(self, session: Optional[Session] = None) -> None:
        self._session = session or db.session

    @property
    def session(self) -> Session:
        return self._session

    # -- Projects -----------------------------------------------------------------
    def create_project(
        self,
        *,
        created_by_org_id: str,
        project_id: str,
    ) -> Project:
        
        if not project_id: 
            raise ValueError("project_id is required")
        if not created_by_org_id:
            raise ValueError("created_by_org_id is required")

        project_kwargs = {"created_by_org_id": created_by_org_id}
        project_kwargs["id"] = project_id

        project = Project(**project_kwargs)
        self.session.add(project)
        self.session.commit()
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        return self.session.get(Project, project_id)

    def list_projects(self, *, org_id: Optional[str] = None) -> Iterable[Project]:
        stmt = select(Project).order_by(Project.created_at.desc())
        if org_id:
            stmt = stmt.where(Project.created_by_org_id == org_id)
        return self.session.execute(stmt).scalars().all()

    def update_project(self, project: Project, /, **changes) -> Project:
        return self._apply_updates(Project, project, changes)

    def delete_project(self, project: Project, *, commit: bool = True) -> None:
        self.session.delete(project)
        if commit:
            self.session.commit()

    def upsert_project_with_requests(
        self,
        *,
        project_id: str,
        created_by_org_id: str,
        stages_payload: Iterable[dict],
    ) -> Project | None:
        if not project_id:
            raise ValueError("project_id is required")
        if not created_by_org_id:
            raise ValueError("created_by_org_id is required")
        if stages_payload is None:
            raise ValueError("stages_payload is required")

        session = self.session
        project = self.get_project(project_id)

        if project is None:
            project = Project(id=project_id, created_by_org_id=created_by_org_id)
            session.add(project)
        else:
            return None
        session.flush()

        for stage_data in stages_payload:
            if not isinstance(stage_data, dict):
                raise ValueError("Each stage entry must be a dictionary")

            requests_payload = stage_data.get("requests") or []
            if not requests_payload:
                continue
            if not isinstance(requests_payload, list):
                raise ValueError("Stage requests must be provided as a list")

            stage_identifier = stage_data.get("id") or stage_data.get("stageId")
            if not stage_identifier:
                raise ValueError("Stage id is required when requests are present")

            stage_kwargs = {
                "id": stage_identifier,
                "project": project,
                "name": stage_data.get("name"),
                "description": stage_data.get("description"),
                "start_date": self._coerce_date(stage_data.get("startDate") or stage_data.get("start_date")),
                "end_date": self._coerce_date(stage_data.get("endDate") or stage_data.get("end_date")),
                "order": self._coerce_int(stage_data.get("order"), default=0),
            }

            stage = Stage(**stage_kwargs)
            session.add(stage)
            session.flush()

            for request_payload in requests_payload:
                if not isinstance(request_payload, dict):
                    raise ValueError("Each request entry must be a dictionary")

                request_type_value = request_payload.get("type")
                if not request_type_value:
                    raise ValueError("Request type is required")

                request_description = request_payload.get("description")
                if not request_description:
                    raise ValueError("Request description is required")

                request_kwargs = {
                    "stage_id": stage.id,
                    "project_id": project.id,
                    "request_type": self._coerce_request_type(request_type_value),
                    "description": request_description,
                    "amount": self._coerce_decimal(request_payload.get("amount"), scale=2),
                    "currency": request_payload.get("currency"),
                    "quantity": self._coerce_decimal(request_payload.get("quantity"), scale=3),
                    "unit": request_payload.get("unit"),
                    "order": self._coerce_int(request_payload.get("order"), default=0),
                    "is_complete": self._coerce_bool(
                        request_payload.get("isComplete", request_payload.get("is_complete")), default=False
                    ),
                }

                request = StageRequest(**request_kwargs)
                session.add(request)

        session.commit()
        return project

    # -- Stages -------------------------------------------------------------------
    def create_stage(
        self,
        *,
        project_id: str,
        name: str,
        description: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        order: int = 0,
    ) -> Stage:
        stage = Stage(
            project_id=project_id,
            name=name,
            description=description,
            start_date=start_date,
            end_date=end_date,
            order=order,
        )
        self.session.add(stage)
        self.session.commit()
        return stage

    def get_stage(self, stage_id: str, *, project_id: str) -> Optional[Stage]:
        if not stage_id:
            raise ValueError("stage_id is required")
        if not project_id:
            raise ValueError("project_id is required to retrieve a stage")

        stmt = select(Stage).where(
            Stage.id == stage_id,
            Stage.project_id == project_id,
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_stages(self, *, project_id: Optional[str] = None) -> Iterable[Stage]:
        stmt = select(Stage)
        if project_id:
            stmt = stmt.where(Stage.project_id == project_id)
        stmt = stmt.order_by(Stage.project_id, Stage.order, Stage.created_at)
        return self.session.execute(stmt).scalars().all()

    def update_stage(self, stage: Stage, /, **changes) -> Stage:
        changes.pop("project_id", None) # project_id is immutable
        return self._apply_updates(Stage, stage, changes)

    def delete_stage(self, stage: Stage, *, commit: bool = True) -> None:
        self.session.delete(stage)
        if commit:
            self.session.commit()

    # -- Requests -----------------------------------------------------------------
    def create_request(
        self,
        *,
        stage_id: str,
        project_id: str,
        request_type: Union[RequestType, str],
        description: str,
        amount: Optional[Union[Decimal, float, str]] = None,
        currency: Optional[str] = None,
        quantity: Optional[Union[Decimal, float, str]] = None,
        unit: Optional[str] = None,
        order: int = 0,
        is_complete: bool = False,
    ) -> StageRequest:
        request = StageRequest(
            stage_id=stage_id,
            project_id=project_id,
            request_type=self._coerce_request_type(request_type),
            description=description,
            amount=self._coerce_decimal(amount, scale=2),
            currency=currency,
            quantity=self._coerce_decimal(quantity, scale=3),
            unit=unit,
            order=order,
            is_complete=bool(is_complete),
        )
        self.session.add(request)
        self.session.commit()
        return request

    def get_request(self, request_id: str) -> Optional[StageRequest]:
        return self.session.get(StageRequest, request_id)

    def list_requests(
        self,
        *,
        project_id: Optional[str] = None,
        stage_id: Optional[str] = None,
        is_complete: Optional[bool] = None,
    ) -> Iterable[StageRequest]:
        stmt = select(StageRequest)
        if project_id:
            stmt = stmt.where(StageRequest.project_id == project_id)
        if stage_id:
            stmt = stmt.where(StageRequest.stage_id == stage_id)
        if is_complete is not None:
            stmt = stmt.where(StageRequest.is_complete.is_(bool(is_complete)))
        return self.session.execute(stmt).scalars().all()

    def update_request(self, request: StageRequest, /, **changes) -> StageRequest:
        changes.pop("stage_id", None)
        changes.pop("project_id", None)
        if "request_type" in changes:
            changes["request_type"] = self._coerce_request_type(changes["request_type"])
        if "amount" in changes:
            changes["amount"] = self._coerce_decimal(changes["amount"], scale=2)
        if "quantity" in changes:
            changes["quantity"] = self._coerce_decimal(changes["quantity"], scale=3)
        if "is_complete" in changes:
            changes["is_complete"] = bool(changes["is_complete"])
        return self._apply_updates(StageRequest, request, changes)

    def delete_request(self, request: StageRequest, *, commit: bool = True) -> None:
        self.session.delete(request)
        if commit:
            self.session.commit()

    def complete_collaboration(self, collaboration_id: str) -> StageRequestCollaboration:
        if not collaboration_id:
            raise ValueError("collaboration_id is required")

        collaboration = self.session.get(StageRequestCollaboration, str(collaboration_id))
        if collaboration is None:
            raise LookupError("Colaboración no encontrada")

        stage_request = self.session.get(StageRequest, collaboration.stage_request_id)
        if stage_request is None:
            raise LookupError("Pedido de ayuda asociado no encontrado")

        if stage_request.is_complete:
            raise RuntimeError("El pedido de ayuda ya fue completado")

        stage_request.is_complete = True
        stage_request.is_being_completed = False
        self.session.add(stage_request)
        self.session.commit()

        return collaboration

    # -- Helpers ------------------------------------------------------------------
    def _apply_updates(self, model_cls, instance, changes):
        mapper = sa_inspect(model_cls)
        column_names = {attr.key for attr in mapper.column_attrs}
        invalid_fields = set(changes) - column_names
        if invalid_fields:
            unknown = ", ".join(sorted(invalid_fields))
            raise AttributeError(f"Unknown field(s) for {model_cls.__name__}: {unknown}")

        immutable_fields = {"id", "created_at", "updated_at"}
        updates = {
            key: value for key, value in changes.items() if key not in immutable_fields
        }

        for field, value in updates.items():
            setattr(instance, field, value)

        self.session.add(instance)
        self.session.commit()
        return instance

    @staticmethod
    def _coerce_request_type(value: Union[RequestType, str]) -> RequestType:
        if isinstance(value, RequestType):
            return value
        if isinstance(value, str):
            normalized = value.strip()
            for enum_value in RequestType:
                if enum_value.value == normalized or enum_value.name == normalized.upper():
                    return enum_value
        raise ValueError(f"Unsupported request type: {value!r}")

    @staticmethod
    def _coerce_decimal(
        value: Optional[Union[Decimal, float, str]], *, scale: Optional[int]
    ) -> Optional[Decimal]:
        if value is None:
            return None
        if isinstance(value, Decimal):
            decimal_value = value
        else:
            try:
                decimal_value = Decimal(str(value))
            except (InvalidOperation, TypeError) as exc:
                raise ValueError(f"Cannot convert {value!r} to Decimal") from exc

        if scale is not None:
            quantizer = Decimal("1").scaleb(-scale)
            decimal_value = decimal_value.quantize(quantizer, rounding=ROUND_HALF_UP)
        return decimal_value

    @staticmethod
    def _coerce_date(value) -> Optional[date]:
        if value is None or value == "":
            return None
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return None
            try:
                return date.fromisoformat(normalized)
            except ValueError:
                try:
                    return datetime.fromisoformat(normalized).date()
                except ValueError as exc:
                    raise ValueError(f"Invalid date value: {value!r}") from exc
        raise ValueError(f"Invalid date value: {value!r}")

    @staticmethod
    def _coerce_int(value, *, default: int = 0) -> int:
        if value is None or value == "":
            return default
        if isinstance(value, bool):
            return int(value)
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Cannot convert {value!r} to int") from exc

    @staticmethod
    def _coerce_bool(value, *, default: bool = False) -> bool:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "y"}:
                return True
            if normalized in {"false", "0", "no", "n"}:
                return False
            raise ValueError(f"Cannot convert {value!r} to bool")
        if isinstance(value, (int, float)):
            return bool(int(value))
        raise ValueError(f"Cannot convert {value!r} to bool")
