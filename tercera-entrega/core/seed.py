from __future__ import annotations

from typing import Tuple

from werkzeug.security import generate_password_hash

from core.database import db
from core.module.users.model import UserRole, User
from core.module.users.repository import UserRepository


def seed_all(app) -> None:
    """
    Seed the database with baseline data.

    This creates a sysadmin account and an auxiliary demo user with
    a different role so the app has both privileged and standard users.
    """
    with app.app_context():
        repo = UserRepository(db.session)
        admin, admin_dirty = _seed_admin(repo)
        if admin_dirty:
            print(f"Seeded admin user: {admin.username}")
        else:
            print("Seed skipped: admin user already exists.")

        # demo_dirty = _seed_demo_users(repo)
        # if demo_dirty:
        #     print("Seeded demo users.")
        # else:
        #     print("Seed skipped: users already exist.")
            
        # bonita_user, bonita_dirty = seed_bonita_user(repo)
        # if bonita_dirty:
        #     print(f"Seeded Bonita service user: {bonita_user.username}")
        # else:
        #     print("Seed skipped: Bonita service user already exists.")
        
        role_users_dirty = _seed_role_users(repo)
        if role_users_dirty:
            print("Seeded role-based users.")
        else:
            print("Seed skipped: role-based users already exist.")


def _seed_admin(repo: UserRepository) -> Tuple[User, bool]:
    username = "admin"
    existing = repo.get_by_username(username)
    if existing:
        return existing, False

    admin = repo.create(
        username=username,
        password_hash=generate_password_hash("admin123"),
        email="admin@example.com",
        is_sysadmin=True,
        is_active=True,
        role=UserRole.SIN_DEFINIR,
    )
    return admin, True


def _seed_demo_users(repo: UserRepository) -> bool:
    
    existing1 = repo.get_by_username("demo1")
    existing2 = repo.get_by_username("demo2")
    existing3 = repo.get_by_username("demo3")
    
    if existing1 or existing2 or existing3:
        return False

    selectable_roles = [role for role in UserRole]
    selectable_roles.sort(key=lambda r: r.value)
    for idx, role in enumerate(selectable_roles):
        username = f"demo{idx+1}"
        existing = repo.get_by_username(username)
        if not existing:
            user = repo.create(
            username=username,
            password_hash=generate_password_hash("demo123"),
            email=f"{username}@example.com",
            is_sysadmin=False,
            role=role,
            )
            print(f"Seeded user: {user.username} ({user.role.value})")
        
    
    return True

def _seed_role_users(repo: UserRepository) -> bool:
    usuarios = [
        {"username": "walter.bates", "email": "walter.bates@example.com"},
        {"username": "ongColaboradora1", "email": "ongColaboradora1@example.com"},
        {"username": "redOng1", "email": "redOng1@example.com"},
        {"username": "consejoDirectivo1", "email": "consejoDirectivo1@example.com"},
        {"username": "sinDefinir1", "email": "sinDefinir1@example.com"},
    ]

    existing_users = [repo.get_by_username(user["username"]) for user in usuarios]

    if any(existing_users):
        return False

    selectable_roles = [role for role in UserRole]

    for user_data, role in zip(usuarios, selectable_roles):
        existing = repo.get_by_username(user_data["username"])
        if not existing:
            user = repo.create(
                username=user_data["username"],
                password_hash=generate_password_hash("bpm"),
                email=user_data["email"],
                is_sysadmin=False,
                role=role,
            )
            print(f"Seeded user: {user.username} ({user.role.value})")

    return True
    
def seed_bonita_user(repo: UserRepository) -> Tuple[User, bool]:
    username = "bonita-service"
    existing = repo.get_by_username(username)
    if existing:
        return existing, False

    bonita_service = repo.create(
        username=username,
        password_hash=generate_password_hash("bonita123"),
        email="bonita-service@example.com",
        is_sysadmin=True,
        is_active=True,
        role=UserRole.SIN_DEFINIR,
    )
    return bonita_service, True
        

__all__ = ["seed_all"]
