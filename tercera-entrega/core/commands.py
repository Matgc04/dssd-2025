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
