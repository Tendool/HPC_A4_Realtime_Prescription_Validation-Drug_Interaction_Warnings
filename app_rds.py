#!/usr/bin/env python3
"""
Zaura Health - EC2 + RDS PostgreSQL Optimized Flask Application
Drug Interaction Prediction API with PostgreSQL database
"""

import os
import sys
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import pickle
import itertools
from typing import List, Dict, Optional
import gc  # Garbage collection for memory optimization

# Import database manager
sys.path.append('/app')
from database.postgres_manager import get_db_manager, close_db_manager

# Configure logging for EC2
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/app.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# EC2 optimized configuration
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production'),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max file size
    TEMPLATES_AUTO_RELOAD=False,  # Disable for production
    JSON_SORT_KEYS=False  # Faster JSON serialization
)

# Global variables for model components
model = None
preprocessor = None
device = None
model_info = None
db_manager = None

class MemoryOptimizedPreprocessor:
    """Memory-optimized preprocessor for t2.micro instances"""
    
    def __init__(self, max_drugs=10):
        self.max_drugs = max_drugs
        self.drug_encoder = None
        self.label_encoder = None
        self.scaler = None
        self.drug_vocab_size = 0
        self.feature_dim = 0
        
    def transform(self, df):
        """Transform new data using fitted preprocessor"""
        try:
            features = self._create_features(df)
            return features
        except Exception as e:
            logger.error(f"Error in preprocessing: {e}")
            raise
    
    def _create_features(self, df):
        """Create feature set optimized for memory usage"""
        # Drug encoding features
        drug_features = self._encode_drugs(df)
        
        # Numerical features
        numerical_features = self._create_numerical_features(df)
        
        # Combine features efficiently
        if numerical_features.shape[1] > 0:
            final_features = np.hstack([drug_features, numerical_features])
        else:
            final_features = drug_features
            
        return final_features.astype(np.float32)
    
    def _encode_drugs(self, df):
        """Encode drug information efficiently"""
        drug_columns = [f'drug{i}' for i in range(1, self.max_drugs + 1)]
        encoded_features = np.zeros((len(df), self.max_drugs), dtype=np.int32)
        
        for i, col in enumerate(drug_columns):
            if col in df.columns:
                filled_col = df[col].fillna('MISSING')
                
                for j, drug in enumerate(filled_col):
                    try:
                        encoded_features[j, i] = self.drug_encoder.transform([drug])[0]
                    except ValueError:
                        encoded_features[j, i] = self.drug_encoder.transform(['UNKNOWN'])[0]
            else:
                missing_code = self.drug_encoder.transform(['MISSING'])[0]
                encoded_features[:, i] = missing_code
        
        return encoded_features
    
    def _create_numerical_features(self, df):
        """Create numerical features efficiently"""
        numerical_features = []
        
        if 'doses_per_24_hrs' in df.columns:
            doses_numeric = self._extract_numeric_doses(df['doses_per_24_hrs'])
            doses_scaled = self.scaler.transform(doses_numeric.reshape(-1, 1))
            numerical_features.append(doses_scaled.flatten())
        
        if 'total_drugs' in df.columns:
            numerical_features.append(df['total_drugs'].fillna(0).values)
        
        if 'has_dosage_info' in df.columns:
            numerical_features.append(df['has_dosage_info'].fillna(0).values)
        
        return np.array(numerical_features).T if numerical_features else np.zeros((len(df), 0))
    
    def _extract_numeric_doses(self, doses_series):
        """Extract numeric values from doses column"""
        def convert_to_numeric(value):
            if pd.isna(value):
                return 0.0
            
            str_value = str(value).strip()
            
            try:
                return float(str_value)
            except ValueError:
                pass
            
            if str_value.upper() in ['TAB', 'VIAL', 'CAP', 'SUPP', 'TUBE', 'BAG', 'SYR']:
                return 1.0
            elif str_value.upper() in ['ML', 'UDCUP']:
                return 1.0
            else:
                import re
                numbers = re.findall(r'\d+(?:\.\d+)?', str_value)
                if numbers:
                    return float(numbers[0])
                else:
                    return 0.0
        
        numeric_doses = doses_series.apply(convert_to_numeric)
        return numeric_doses.values

class OptimizedDrugInteractionNet(nn.Module):
    """Optimized Neural Network for limited memory environments"""
    
    def __init__(self, input_size, drug_vocab_size, embedding_dim=32, 
                 hidden_sizes=[128, 64], num_classes=2, dropout_rate=0.2):
        super().__init__()
        
        self.max_drugs = 10
        self.embedding_dim = embedding_dim
        
        # Smaller embedding layer for memory efficiency
        self.drug_embedding = nn.Embedding(drug_vocab_size, embedding_dim, padding_idx=0)
        
        embedding_features = self.max_drugs * embedding_dim
        numerical_features = input_size - self.max_drugs
        total_input_size = embedding_features + numerical_features
        
        # Smaller network for t2.micro
        layers = []
        prev_size = total_input_size
        
        for hidden_size in hidden_sizes:
            layers.extend([
                nn.Linear(prev_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(dropout_rate)
            ])
            prev_size = hidden_size
        
        self.main_layers = nn.Sequential(*layers)
        self.output = nn.Linear(prev_size, num_classes)
        
        self._init_weights()
    
    def _init_weights(self):
        """Initialize network weights"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Embedding):
                nn.init.normal_(m.weight, 0, 0.1)
    
    def forward(self, x):
        batch_size = x.size(0)
        
        drug_features = x[:, :self.max_drugs].long()
        numerical_features = x[:, self.max_drugs:]
        
        drug_embeddings = self.drug_embedding(drug_features)
        drug_features_flat = drug_embeddings.view(batch_size, -1)
        
        combined_features = torch.cat([drug_features_flat, numerical_features], dim=1)
        
        x = self.main_layers(combined_features)
        x = self.output(x)
        
        return x

def load_model():
    """Load the trained model optimized for EC2"""
    global model, preprocessor, device, model_info
    
    try:
        # Use CPU for t2.micro (no GPU)
        device = torch.device('cpu')
        logger.info(f"Using device: {device}")
        
        # Load model components
        logger.info("Loading model components...")
        
        with open('/app/models/enhanced_model_info.pkl', 'rb') as f:
            model_info = pickle.load(f)
        
        with open('/app/models/enhanced_drug_interaction_preprocessor.pkl', 'rb') as f:
            preprocessor = pickle.load(f)
        
        # Use optimized model architecture
        model = OptimizedDrugInteractionNet(
            input_size=model_info['model_architecture']['input_size'],
            drug_vocab_size=model_info['model_architecture']['drug_vocab_size'],
            embedding_dim=32,  # Reduced for memory efficiency
            hidden_sizes=[128, 64],  # Smaller network
            num_classes=model_info['model_architecture']['num_classes'],
            dropout_rate=0.2
        ).to(device)
        
        # Load trained weights with map_location for CPU
        model_state = torch.load('/app/models/best_enhanced_drug_interaction_model.pth', 
                                map_location=device)
        model.load_state_dict(model_state)
        model.eval()
        
        # Clean up memory
        del model_state
        gc.collect()
        
        logger.info("✓ Model loaded successfully")
        logger.info(f"Model accuracy: {model_info['performance']['test_accuracy']:.4f}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return False

def initialize_database():
    """Initialize database connection"""
    global db_manager
    try:
        db_manager = get_db_manager()
        logger.info("✓ Database connection initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False

def predict_drug_combinations(drugs: List[str], dosage: Optional[float] = None, 
                            user_id: Optional[int] = None, 
                            request_info: Optional[Dict] = None) -> Dict:
    """
    Memory-optimized prediction function with database logging
    """
    request_start_time = datetime.utcnow()
    
    try:
        if len(drugs) < 2:
            return {"error": "At least 2 drugs are required for interaction analysis"}
        
        if len(drugs) > 6:  # Reduced limit for memory efficiency
            return {"error": "Maximum 6 drugs supported per analysis on this instance"}
        
        cleaned_drugs = [drug.strip().title() for drug in drugs if drug.strip()]
        
        if len(cleaned_drugs) < 2:
            return {"error": "At least 2 valid drug names are required"}
        
        # Remove duplicates
        seen = set()
        unique_drugs = []
        for drug in cleaned_drugs:
            if drug not in seen:
                seen.add(drug)
                unique_drugs.append(drug)
        
        logger.info(f"Analyzing {len(unique_drugs)} drugs: {unique_drugs}")
        
        # Generate combinations (limited for memory)
        all_combinations = []
        for r in range(2, min(len(unique_drugs) + 1, 5)):  # Limit combinations
            for combo in itertools.combinations(unique_drugs, r):
                all_combinations.append(list(combo))
        
        combination_results = {}
        
        def predict_single_combination(drug_combo: List[str]) -> Dict:
            try:
                prediction_data = {}
                
                # Create data structure
                for i in range(1, 11):
                    col_name = f'drug{i}'
                    if i <= len(drug_combo):
                        prediction_data[col_name] = [drug_combo[i-1]]
                    else:
                        prediction_data[col_name] = [None]
                
                prediction_data['doses_per_24_hrs'] = [dosage if dosage is not None else 0.0]
                prediction_data['total_drugs'] = [len(drug_combo)]
                prediction_data['has_dosage_info'] = [1 if dosage is not None else 0]
                prediction_data['subject_id'] = [0]
                prediction_data['drug_combination_id'] = ['_'.join(drug_combo)]
                
                df_pred = pd.DataFrame(prediction_data)
                X_pred = preprocessor.transform(df_pred)
                
                # Make prediction
                with torch.no_grad():
                    X_tensor = torch.FloatTensor(X_pred).to(device)
                    output = model(X_tensor)
                    probs = F.softmax(output, dim=1)
                    pred_class = output.argmax(dim=1).item()
                    confidence = probs[0][pred_class].item()
                
                prediction = preprocessor.label_encoder.inverse_transform([pred_class])[0]
                
                # Clean up
                del X_tensor, output, probs
                
                return {
                    "prediction": prediction,
                    "confidence": confidence,
                    "safe_probability": probs[0][0].item() if len(probs[0]) > 0 else 0,
                    "unsafe_probability": probs[0][1].item() if len(probs[0]) > 1 else 0,
                    "drug_count": len(drug_combo)
                }
                
            except Exception as e:
                logger.error(f"Error predicting combination {drug_combo}: {e}")
                return {"error": str(e)}
        
        # Process combinations
        for combo in all_combinations:
            result = predict_single_combination(combo)
            combo_key = " + ".join(combo)
            combination_results[combo_key] = result
        
        # Analyze results
        safe_combinations = [k for k, v in combination_results.items() 
                           if v.get('prediction') == 'safe']
        unsafe_combinations = [k for k, v in combination_results.items() 
                             if v.get('prediction') == 'unsafe']
        error_combinations = [k for k, v in combination_results.items() 
                            if 'error' in v]
        
        # Calculate response time
        response_time = (datetime.utcnow() - request_start_time).total_seconds() * 1000
        
        result = {
            "status": "success",
            "input_drugs": unique_drugs,
            "dosage_info": f"{dosage} doses/24hrs" if dosage else "No dosage specified",
            "total_combinations": len(all_combinations),
            "safe_combinations": len(safe_combinations),
            "unsafe_combinations": len(unsafe_combinations),
            "error_combinations": len(error_combinations),
            "overall_safety": "SAFE" if len(unsafe_combinations) == 0 and len(error_combinations) == 0 else "UNSAFE",
            "safety_score": len(safe_combinations) / len(all_combinations) if all_combinations else 0,
            "detailed_results": combination_results,
            "safe_combination_list": safe_combinations,
            "unsafe_combination_list": unsafe_combinations,
            "response_time_ms": int(response_time),
            "memory_optimized": True,
            "database_enabled": True
        }
        
        # Log prediction to database
        if db_manager:
            try:
                db_manager.log_prediction(
                    user_id=user_id,
                    input_drugs=unique_drugs,
                    dosage_info=dosage,
                    prediction_result=result,
                    response_time_ms=int(response_time),
                    ip_address=request_info.get('ip_address') if request_info else None,
                    user_agent=request_info.get('user_agent') if request_info else None
                )
            except Exception as e:
                logger.error(f"Failed to log prediction to database: {e}")
        
        # Force garbage collection
        gc.collect()
        
        return result
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        gc.collect()  # Clean up on error
        return {"error": f"Prediction failed: {str(e)}"}

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/predict', methods=['POST'])
def api_predict():
    """API endpoint for drug interaction prediction"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        drugs = data.get('drugs', [])
        dosage = data.get('dosage')
        
        if not drugs:
            return jsonify({"error": "No drugs provided"}), 400
        
        # Validate dosage
        if dosage is not None:
            try:
                dosage = float(dosage)
                if dosage < 0:
                    return jsonify({"error": "Dosage must be positive"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid dosage format"}), 400
        
        # Get request info for logging
        request_info = {
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent')
        }
        
        # Make prediction
        result = predict_drug_combinations(drugs, dosage, request_info=request_info)
        
        if "error" in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    try:
        # Get system info
        import psutil
        memory = psutil.virtual_memory()
        
        # Test database connection
        db_status = "connected" if db_manager else "disconnected"
        
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "model_loaded": model is not None,
            "device": str(device) if device else None,
            "database_status": db_status,
            "environment": "EC2-RDS-optimized",
            "memory_usage_percent": memory.percent,
            "memory_available_mb": memory.available // 1024 // 1024
        }
        
        if model_info:
            health_data["model_accuracy"] = model_info['performance']['test_accuracy']
        
        return jsonify(health_data)
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "unhealthy", 
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

@app.route('/api/drug-suggestions')
def drug_suggestions():
    """Get drug suggestions for autocomplete"""
    try:
        query = request.args.get('q', '').lower()
        
        if not query or len(query) < 2:
            return jsonify([])
        
        if preprocessor and hasattr(preprocessor, 'drug_encoder'):
            all_drugs = list(preprocessor.drug_encoder.classes_)
            
            # Simple matching for performance
            suggestions = [drug for drug in all_drugs 
                          if query in drug.lower() 
                          and drug not in ['UNKNOWN', 'MISSING']
                          and len(drug) > 2][:15]  # Limit results
            
            return jsonify(suggestions)
        
        return jsonify([])
        
    except Exception as e:
        logger.error(f"Error getting drug suggestions: {e}")
        return jsonify([])

@app.route('/api/stats')
def get_stats():
    """Get application statistics"""
    try:
        if not db_manager:
            return jsonify({"error": "Database not available"}), 503
        
        # Get recent prediction history (last 100 predictions)
        history = db_manager.get_prediction_history(limit=100)
        
        stats = {
            "total_predictions": len(history),
            "recent_predictions": len([h for h in history if 
                                    (datetime.utcnow() - h['created_at']).days <= 7]),
            "average_response_time": sum(h['response_time_ms'] for h in history) / len(history) if history else 0,
            "database_records": len(history),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({"error": "Failed to get statistics"}), 500

# Cleanup function
@app.teardown_appcontext
def cleanup_db_connection(error):
    """Cleanup database connections"""
    pass

if __name__ == '__main__':
    # Create logs directory
    os.makedirs('/app/logs', exist_ok=True)
    
    # Initialize database connection
    logger.info("Initializing database connection...")
    if not initialize_database():
        logger.error("Failed to initialize database. Please check your configuration.")
        sys.exit(1)
    
    # Load model on startup
    logger.info("Loading Zaura Health Model for EC2 + RDS...")
    
    if not load_model():
        logger.error("Failed to load model. Please ensure model files exist.")
        sys.exit(1)
    
    logger.info("✓ Zaura Health API ready on EC2 with PostgreSQL!")
    
    # Run the application
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    finally:
        # Cleanup on shutdown
        close_db_manager()
        logger.info("Application shutdown complete")