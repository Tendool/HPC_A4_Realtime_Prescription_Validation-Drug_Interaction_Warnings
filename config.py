#!/usr/bin/env python3
"""
Configuration management for Zaura Health application
Handles environment-specific settings and AWS integration
"""

import os
from typing import Dict, Any
import boto3
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)

class Config:
    """Base configuration class"""
    
    # Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    # Application Configuration
    APP_NAME = os.environ.get('APP_NAME', 'zaura-health-app')
    APP_PORT = int(os.environ.get('APP_PORT', 5000))
    HOST = os.environ.get('HOST', '0.0.0.0')
    
    # AWS Configuration
    AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
    AWS_DEFAULT_REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
    
    # Model Configuration
    MODEL_PATH = os.environ.get('MODEL_PATH', '/app/models')
    S3_BUCKET_MODELS = os.environ.get('S3_BUCKET_MODELS', '')
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FORMAT = os.environ.get('LOG_FORMAT', 
                               '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Performance Configuration
    GUNICORN_WORKERS = int(os.environ.get('GUNICORN_WORKERS', 2))
    GUNICORN_TIMEOUT = int(os.environ.get('GUNICORN_TIMEOUT', 120))
    GUNICORN_KEEPALIVE = int(os.environ.get('GUNICORN_KEEPALIVE', 60))
    
    # Health Check Configuration
    HEALTH_CHECK_PATH = os.environ.get('HEALTH_CHECK_PATH', '/api/health')
    HEALTH_CHECK_INTERVAL = int(os.environ.get('HEALTH_CHECK_INTERVAL', 30))
    
    # Database Configuration
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///zaura_health.db')
    
    # Monitoring Configuration
    ENABLE_METRICS = os.environ.get('ENABLE_METRICS', 'false').lower() == 'true'
    METRICS_PORT = int(os.environ.get('METRICS_PORT', 9090))
    
    @classmethod
    def load_from_aws_secrets(cls, secret_name: str = None) -> Dict[str, Any]:
        """Load configuration from AWS Secrets Manager"""
        try:
            if not secret_name:
                secret_name = f"zaura-health/{cls.FLASK_ENV}/app-secrets"
            
            session = boto3.session.Session()
            client = session.client(
                service_name='secretsmanager',
                region_name=cls.AWS_REGION
            )
            
            response = client.get_secret_value(SecretId=secret_name)
            
            import json
            secrets = json.loads(response['SecretString'])
            
            # Update environment variables with secrets
            for key, value in secrets.items():
                os.environ[key] = str(value)
            
            logger.info(f"Successfully loaded secrets from AWS Secrets Manager: {secret_name}")
            return secrets
            
        except ClientError as e:
            logger.warning(f"Could not load secrets from AWS: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error loading secrets: {e}")
            return {}
    
    @classmethod
    def setup_logging(cls):
        """Set up logging configuration"""
        logging.basicConfig(
            level=getattr(logging, cls.LOG_LEVEL.upper()),
            format=cls.LOG_FORMAT
        )
        
        # Set up AWS SDK logging
        boto3.set_stream_logger('boto3', logging.WARNING)
        boto3.set_stream_logger('botocore', logging.WARNING)

class DevelopmentConfig(Config):
    """Development configuration"""
    FLASK_DEBUG = True
    LOG_LEVEL = 'DEBUG'
    GUNICORN_WORKERS = 1

class ProductionConfig(Config):
    """Production configuration"""
    FLASK_DEBUG = False
    LOG_LEVEL = 'WARNING'
    GUNICORN_WORKERS = 4
    GUNICORN_TIMEOUT = 300

class TestingConfig(Config):
    """Testing configuration"""
    FLASK_DEBUG = True
    TESTING = True
    DATABASE_URL = 'sqlite:///:memory:'

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config(environment: str = None) -> Config:
    """Get configuration class based on environment"""
    if environment is None:
        environment = os.environ.get('FLASK_ENV', 'development')
    
    return config.get(environment, config['default'])

def initialize_app_config(app, environment: str = None):
    """Initialize Flask app with configuration"""
    config_class = get_config(environment)
    
    # Load secrets from AWS if in production
    if environment == 'production':
        config_class.load_from_aws_secrets()
    
    # Configure Flask app
    app.config.from_object(config_class)
    
    # Setup logging
    config_class.setup_logging()
    
    logger.info(f"Application configured for {environment} environment")
    
    return app