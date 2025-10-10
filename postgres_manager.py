#!/usr/bin/env python3
"""
Zaura Health - PostgreSQL Database Module
Database operations using PostgreSQL for production deployment
"""

import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
import boto3
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import hashlib

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manages PostgreSQL database connections and operations for Zaura Health"""
    
    def __init__(self):
        self.pool = None
        self.db_config = {}
        self._initialize_connection()
    
    def _get_db_credentials(self) -> Dict[str, str]:
        """Retrieve database credentials from AWS Systems Manager Parameter Store"""
        try:
            # Try to get from environment variables first (for local development)
            if os.environ.get('DATABASE_URL'):
                import urllib.parse as urlparse
                url = urlparse.urlparse(os.environ['DATABASE_URL'])
                return {
                    'host': url.hostname,
                    'port': url.port or 5432,
                    'database': url.path[1:],  # Remove leading '/'
                    'username': url.username,
                    'password': url.password
                }
            
            # Get from AWS Systems Manager Parameter Store
            session = boto3.Session()
            ssm = session.client('ssm', region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))
            
            project_name = os.environ.get('PROJECT_NAME', 'zaura-health')
            environment = os.environ.get('ENVIRONMENT', 'dev')
            
            # Get database URL from Parameter Store
            parameter_name = f"/{project_name}/{environment}/database/url"
            response = ssm.get_parameter(Name=parameter_name, WithDecryption=True)
            db_url = response['Parameter']['Value']
            
            # Parse the database URL
            import urllib.parse as urlparse
            url = urlparse.urlparse(db_url)
            
            return {
                'host': url.hostname,
                'port': url.port or 5432,
                'database': url.path[1:],  # Remove leading '/'
                'username': url.username,
                'password': url.password
            }
            
        except Exception as e:
            logger.error(f"Error retrieving database credentials: {e}")
            # Fallback to environment variables
            return {
                'host': os.environ.get('DB_HOST', 'localhost'),
                'port': int(os.environ.get('DB_PORT', 5432)),
                'database': os.environ.get('DB_NAME', 'zaura_health'),
                'username': os.environ.get('DB_USERNAME', 'postgres'),
                'password': os.environ.get('DB_PASSWORD', 'password')
            }
    
    def _initialize_connection(self):
        """Initialize database connection pool"""
        try:
            self.db_config = self._get_db_credentials()
            
            # Create connection pool for thread safety
            self.pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=5,  # Limited for t2.micro
                host=self.db_config['host'],
                port=self.db_config['port'],
                database=self.db_config['database'],
                user=self.db_config['username'],
                password=self.db_config['password'],
                cursor_factory=RealDictCursor
            )
            
            logger.info("Database connection pool initialized successfully")
            
            # Initialize database schema
            self._initialize_schema()
            
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            raise
    
    def get_connection(self):
        """Get a connection from the pool"""
        if not self.pool:
            self._initialize_connection()
        return self.pool.getconn()
    
    def return_connection(self, conn):
        """Return a connection to the pool"""
        if self.pool:
            self.pool.putconn(conn)
    
    def _initialize_schema(self):
        """Initialize database schema if not exists"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Create users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL CHECK (role IN ('doctor', 'scientist')),
                    full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                );
            ''')
            
            # Create drug contributions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS drug_contributions (
                    id SERIAL PRIMARY KEY,
                    contributor_id INTEGER REFERENCES users(id),
                    drug_combination TEXT NOT NULL,
                    safety_label VARCHAR(20) NOT NULL CHECK (safety_label IN ('safe', 'unsafe')),
                    dosage_info TEXT,
                    notes TEXT,
                    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
                    source VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
                );
            ''')
            
            # Create predictions log table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS prediction_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    input_drugs TEXT[] NOT NULL,
                    dosage_info DECIMAL(10,2),
                    prediction_result JSONB,
                    response_time_ms INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ip_address INET,
                    user_agent TEXT
                );
            ''')
            
            # Create feedback table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_feedback (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    prediction_id INTEGER REFERENCES prediction_logs(id),
                    feedback_type VARCHAR(20) CHECK (feedback_type IN ('accuracy', 'bug', 'suggestion')),
                    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
                    feedback_text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ''')
            
            # Create indexes for performance
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                CREATE INDEX IF NOT EXISTS idx_drug_contributions_contributor ON drug_contributions(contributor_id);
                CREATE INDEX IF NOT EXISTS idx_drug_contributions_status ON drug_contributions(status);
                CREATE INDEX IF NOT EXISTS idx_prediction_logs_user ON prediction_logs(user_id);
                CREATE INDEX IF NOT EXISTS idx_prediction_logs_created ON prediction_logs(created_at);
                CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
            ''')
            
            conn.commit()
            logger.info("Database schema initialized successfully")
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error initializing database schema: {e}")
            raise
        finally:
            if conn:
                self.return_connection(conn)
    
    def create_user(self, username: str, password: str, role: str, full_name: str, email: str = None) -> Optional[int]:
        """Create a new user"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Hash password
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            cursor.execute('''
                INSERT INTO users (username, password_hash, role, full_name, email)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            ''', (username, password_hash, role, full_name, email))
            
            user_id = cursor.fetchone()['id']
            conn.commit()
            
            logger.info(f"User {username} created successfully with ID {user_id}")
            return user_id
            
        except psycopg2.IntegrityError as e:
            if conn:
                conn.rollback()
            logger.error(f"User creation failed - username already exists: {username}")
            return None
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error creating user: {e}")
            return None
        finally:
            if conn:
                self.return_connection(conn)
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate user and return user info"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            cursor.execute('''
                SELECT id, username, role, full_name, email, created_at, last_login
                FROM users 
                WHERE username = %s AND password_hash = %s;
            ''', (username, password_hash))
            
            user = cursor.fetchone()
            
            if user:
                # Update last login
                cursor.execute('''
                    UPDATE users SET last_login = CURRENT_TIMESTAMP 
                    WHERE id = %s;
                ''', (user['id'],))
                conn.commit()
                
                logger.info(f"User {username} authenticated successfully")
                return dict(user)
            
            return None
            
        except Exception as e:
            logger.error(f"Error authenticating user: {e}")
            return None
        finally:
            if conn:
                self.return_connection(conn)
    
    def add_drug_contribution(self, contributor_id: int, drug_combination: str, 
                            safety_label: str, dosage_info: str = None, 
                            notes: str = None, confidence_level: int = 3,
                            source: str = "user_contribution") -> Optional[int]:
        """Add a drug interaction contribution"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO drug_contributions 
                (contributor_id, drug_combination, safety_label, dosage_info, 
                 notes, confidence_level, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            ''', (contributor_id, drug_combination, safety_label, dosage_info, 
                  notes, confidence_level, source))
            
            contribution_id = cursor.fetchone()['id']
            conn.commit()
            
            logger.info(f"Drug contribution added with ID {contribution_id}")
            return contribution_id
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error adding drug contribution: {e}")
            return None
        finally:
            if conn:
                self.return_connection(conn)
    
    def log_prediction(self, user_id: Optional[int], input_drugs: List[str], 
                      dosage_info: Optional[float], prediction_result: Dict,
                      response_time_ms: int, ip_address: str = None,
                      user_agent: str = None) -> Optional[int]:
        """Log a prediction request"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO prediction_logs 
                (user_id, input_drugs, dosage_info, prediction_result, 
                 response_time_ms, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            ''', (user_id, input_drugs, dosage_info, 
                  psycopg2.extras.Json(prediction_result), 
                  response_time_ms, ip_address, user_agent))
            
            log_id = cursor.fetchone()['id']
            conn.commit()
            
            return log_id
            
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error logging prediction: {e}")
            return None
        finally:
            if conn:
                self.return_connection(conn)
    
    def get_user_contributions(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get contributions by a specific user"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, drug_combination, safety_label, dosage_info, 
                       notes, confidence_level, source, created_at, status
                FROM drug_contributions 
                WHERE contributor_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
            ''', (user_id, limit))
            
            contributions = cursor.fetchall()
            return [dict(contrib) for contrib in contributions]
            
        except Exception as e:
            logger.error(f"Error getting user contributions: {e}")
            return []
        finally:
            if conn:
                self.return_connection(conn)
    
    def get_prediction_history(self, user_id: Optional[int] = None, limit: int = 100) -> List[Dict]:
        """Get prediction history"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            if user_id:
                cursor.execute('''
                    SELECT id, input_drugs, dosage_info, prediction_result, 
                           response_time_ms, created_at
                    FROM prediction_logs 
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s;
                ''', (user_id, limit))
            else:
                cursor.execute('''
                    SELECT id, input_drugs, dosage_info, prediction_result, 
                           response_time_ms, created_at
                    FROM prediction_logs 
                    ORDER BY created_at DESC
                    LIMIT %s;
                ''', (limit,))
            
            history = cursor.fetchall()
            return [dict(record) for record in history]
            
        except Exception as e:
            logger.error(f"Error getting prediction history: {e}")
            return []
        finally:
            if conn:
                self.return_connection(conn)
    
    def close(self):
        """Close database connection pool"""
        if self.pool:
            self.pool.closeall()
            logger.info("Database connection pool closed")

# Global database manager instance
db_manager = None

def get_db_manager():
    """Get or create database manager instance"""
    global db_manager
    if db_manager is None:
        db_manager = DatabaseManager()
    return db_manager

def close_db_manager():
    """Close database manager"""
    global db_manager
    if db_manager:
        db_manager.close()
        db_manager = None