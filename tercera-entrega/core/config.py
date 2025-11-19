from dotenv import load_dotenv
import secrets
import os
from datetime import timedelta

load_dotenv()



class Config(object):
    """BASE CONFIGURATION

    Attributes:
        
    """
    TESTING = False
    DEBUG = False
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY") or "dev-fallback-key"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "dev-fallback-key"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or "sqlite:///database.db"
   


class ProductionConfig(Config):
    """PRODUCTION CONFIGURATION

    Attributes:
        
    """
    DEBUG = False



class DevelopmentConfig(Config):
    """DEVELOPMENT CONFIGURATION

    Attributes:
        
    """
    DEBUG = True


config = {
    "production": ProductionConfig,
    "development": DevelopmentConfig
}
