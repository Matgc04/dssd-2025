from __future__ import annotations

from enum import Enum
from uuid import uuid4

from sqlalchemy import Enum as SAEnum, func, and_

from typing import List
from sqlalchemy.orm import Mapped, relationship, foreign

from core.database import db


class RequestType(str, Enum):
    MONETARIO = "economic"
    MATERIALES = "materials"
    MANO_DE_OBRA = "labor"
    OTRO = "other"


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    created_by_org_id = db.Column(db.String(255), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    stages: Mapped[List["Stage"]] = relationship(
        "Stage",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Stage.order",
    )


class Stage(db.Model):
    __tablename__ = "project_stages"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id = db.Column(
        db.String(36),
        db.ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(1000), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    project = db.relationship("Project", back_populates="stages")
    requests: Mapped[List["StageRequest"]] = relationship(
        "StageRequest",
        back_populates="stage",
        cascade="all, delete-orphan",
        order_by="StageRequest.order",
    )


class StageRequest(db.Model):
    __tablename__ = "project_stage_requests"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    stage_id = db.Column(db.String(36), nullable=False, index=True)
    project_id = db.Column(db.String(36), nullable=False, index=True)
    __table_args__ = (
        db.ForeignKeyConstraint(
            ["project_id", "stage_id"],
            ["project_stages.project_id", "project_stages.id"],
            ondelete="CASCADE",
        ),
    )
    request_type = db.Column(
        SAEnum(RequestType, name="project_request_type"), nullable=False
    )
    description = db.Column(db.String(300), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=True)
    currency = db.Column(db.String(3), nullable=True)
    quantity = db.Column(db.Numeric(15, 3), nullable=True)
    unit = db.Column(db.String(50), nullable=True)
    order = db.Column(db.Integer, nullable=False, default=0)
    is_complete = db.Column(db.Boolean, nullable=False, default=False)
    is_being_completed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    stage = db.relationship(
        "Stage",
        back_populates="requests",
        primaryjoin=lambda: and_(
            Stage.project_id == foreign(StageRequest.project_id),
            Stage.id == foreign(StageRequest.stage_id),
        ),
        foreign_keys=[project_id, stage_id],
    )
    collaborations = db.relationship("StageRequestCollaboration", back_populates="stage_request")

class StageRequestCollaboration(db.Model):
    __tablename__ = "project_stage_request_collaborations"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    stage_request_id = db.Column(
        db.String(36),
        db.ForeignKey("project_stage_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    collaborator_org_id = db.Column(db.String(255), nullable=False)
    committed_amount = db.Column(db.Numeric(15, 2), nullable=True)
    committed_quantity = db.Column(db.Numeric(15, 3), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updated_at = db.Column(
        db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    stage_request = db.relationship("StageRequest", back_populates="collaborations")
