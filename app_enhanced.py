#!/usr/bin/env python3
"""
Enhanced Flask application with AWS integration and monitoring
Zaura Health - Drug Interaction Prediction API with cloud-native features
"""

import os
import sys
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import pickle
import itertools
from typing import List, Dict, Optional

# Import configuration
sys.path.append('config')
try:
    from config.config import initialize_app_config, get_config
except ImportError:
    # Fallback if config module is not available
    def initialize_app_config(app, environment=None):
        return app
    def get_config(environment=None):
        class Config:
            pass
        return Config()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize configuration
config = get_config()
initialize_app_config(app, os.environ.get('FLASK_ENV', 'development'))

# Global variables for model components
model = None
preprocessor = None
device = None
model_info = None
s3_client = None

class AWSModelLoader:
    """Handles model loading from local files or S3"""
    
    def __init__(self):
        self.s3_client = None
        self.bucket_name = os.environ.get('S3_BUCKET_MODELS', '')
        
        if self.bucket_name:
            try:
                self.s3_client = boto3.client('s3')
                logger.info(f"AWS S3 client initialized for bucket: {self.bucket_name}")
            except Exception as e:
                logger.warning(f"Failed to initialize S3 client: {e}")
    
    def download_model_files(self):
        """Download model files from S3 if available"""
        if not self.s3_client or not self.bucket_name:
            logger.info("Using local model files")
            return True
        
        model_files = [
            'models/best_enhanced_drug_interaction_model.pth',
            'models/enhanced_drug_interaction_preprocessor.pkl',
            'models/enhanced_model_info.pkl'
        ]
        
        try:
            for file_path in model_files:
                s3_key = file_path
                local_path = file_path
                
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                
                # Check if file exists locally and is recent
                if os.path.exists(local_path):
                    local_mtime = datetime.fromtimestamp(os.path.getmtime(local_path))
                    
                    # Check S3 object modification time
                    try:
                        response = self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
                        s3_mtime = response['LastModified'].replace(tzinfo=None)
                        
                        if local_mtime >= s3_mtime:
                            logger.info(f"Local file {local_path} is up to date")
                            continue
                    except ClientError:
                        logger.info(f"File {s3_key} not found in S3, using local version")
                        continue
                
                # Download from S3
                logger.info(f"Downloading {s3_key} from S3...")
                self.s3_client.download_file(self.bucket_name, s3_key, local_path)
                logger.info(f"Downloaded {local_path} successfully")
            
            return True
            
        except Exception as e:
            logger.error(f"Error downloading model files from S3: {e}")
            logger.info("Falling back to local model files")
            return True  # Continue with local files

# Import your existing model classes here
class AdvancedDrugInteractionPreprocessor:
    """Advanced preprocessor for drug interaction data with enhanced feature engineering"""
    
    def __init__(self, max_drugs=10):
        self.max_drugs = max_drugs
        self.drug_encoder = None
        self.label_encoder = None
        self.scaler = None
        self.drug_vocab_size = 0
        self.feature_dim = 0
        
    def transform(self, df):
        """Transform new data using fitted preprocessor"""
        features = self._create_features(df)
        return features
    
    def _create_features(self, df):
        """Create comprehensive feature set for drug combinations"""
        # Drug encoding features
        drug_features = self._encode_drugs(df)
        
        # Numerical features
        numerical_features = self._create_numerical_features(df)
        
        # Combine features
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
                # Handle missing values
                filled_col = df[col].fillna('MISSING')
                
                for j, drug in enumerate(filled_col):
                    try:
                        encoded_features[j, i] = self.drug_encoder.transform([drug])[0]
                    except ValueError:
                        # Unknown drug
                        encoded_features[j, i] = self.drug_encoder.transform(['UNKNOWN'])[0]
            else:
                # Column doesn't exist
                missing_code = self.drug_encoder.transform(['MISSING'])[0]
                encoded_features[:, i] = missing_code
        
        return encoded_features
    
    def _create_numerical_features(self, df):
        """Create numerical features efficiently with proper handling of mixed data types"""
        numerical_features = []
        
        # Dosage features - handle mixed numeric/text data
        if 'doses_per_24_hrs' in df.columns:
            doses_numeric = self._extract_numeric_doses(df['doses_per_24_hrs'])
            doses_scaled = self.scaler.transform(doses_numeric.reshape(-1, 1))
            numerical_features.append(doses_scaled.flatten())
        
        # Drug count features
        if 'total_drugs' in df.columns:
            numerical_features.append(df['total_drugs'].fillna(0).values)
        
        # Dosage availability
        if 'has_dosage_info' in df.columns:
            numerical_features.append(df['has_dosage_info'].fillna(0).values)
        
        return np.array(numerical_features).T if numerical_features else np.zeros((len(df), 0))
    
    def _extract_numeric_doses(self, doses_series):
        """Extract numeric values from mixed doses_per_24_hrs column"""
        def convert_to_numeric(value):
            if pd.isna(value):
                return 0.0
            
            # Convert to string for processing
            str_value = str(value).strip()
            
            # Try to convert directly to float first
            try:
                return float(str_value)
            except ValueError:
                pass
            
            # Handle common text cases
            if str_value.upper() in ['TAB', 'VIAL', 'CAP', 'SUPP', 'TUBE', 'BAG', 'SYR']:
                return 1.0  # Assume 1 unit per day
            elif str_value.upper() in ['ML', 'UDCUP']:
                return 1.0  # Assume 1 mL or 1 cup per day
            else:
                # Try to extract numbers from strings like "250mg" or "500"
                import re
                numbers = re.findall(r'\d+(?:\.\d+)?', str_value)
                if numbers:
                    return float(numbers[0])
                else:
                    return 0.0  # Default for unrecognizable formats
        
        # Apply conversion to all values
        numeric_doses = doses_series.apply(convert_to_numeric)
        return numeric_doses.values

class AdvancedDrugInteractionNet(nn.Module):
    """Advanced Neural Network for Drug Interaction Prediction with drug embeddings"""
    
    def __init__(self, input_size, drug_vocab_size, embedding_dim=64, 
                 hidden_sizes=[256, 128, 64], num_classes=2, dropout_rate=0.3):
        super().__init__()
        
        self.max_drugs = 10
        self.embedding_dim = embedding_dim
        
        # Drug embedding layer for better drug representation
        self.drug_embedding = nn.Embedding(drug_vocab_size, embedding_dim, padding_idx=0)
        
        # Calculate input size for main network
        embedding_features = self.max_drugs * embedding_dim
        numerical_features = input_size - self.max_drugs
        total_input_size = embedding_features + numerical_features
        
        # Main neural network layers with batch normalization
        layers = []
        prev_size = total_input_size
        
        for hidden_size in hidden_sizes:
            layers.extend([
                nn.Linear(prev_size, hidden_size),
                nn.BatchNorm1d(hidden_size),
                nn.ReLU(),
                nn.Dropout(dropout_rate)
            ])
            prev_size = hidden_size
        
        self.main_layers = nn.Sequential(*layers)
        self.output = nn.Linear(prev_size, num_classes)
        
        # Initialize weights
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
        
        # Split input into drug features and numerical features
        drug_features = x[:, :self.max_drugs].long()
        numerical_features = x[:, self.max_drugs:]
        
        # Get drug embeddings
        drug_embeddings = self.drug_embedding(drug_features)
        drug_features_flat = drug_embeddings.view(batch_size, -1)
        
        # Combine features
        combined_features = torch.cat([drug_features_flat, numerical_features], dim=1)
        
        # Pass through main network
        x = self.main_layers(combined_features)
        x = self.output(x)
        
        return x

def load_model():
    """Load the trained model and preprocessor with AWS S3 support"""
    global model, preprocessor, device, model_info
    
    try:
        # Initialize AWS model loader
        model_loader = AWSModelLoader()
        
        # Download model files if needed
        model_loader.download_model_files()
        
        # Check device availability
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {device}")
        
        # Load model info
        with open('models/enhanced_model_info.pkl', 'rb') as f:
            model_info = pickle.load(f)
        
        # Load preprocessor
        with open('models/enhanced_drug_interaction_preprocessor.pkl', 'rb') as f:
            preprocessor = pickle.load(f)
        
        # Initialize model architecture
        model = AdvancedDrugInteractionNet(
            input_size=model_info['model_architecture']['input_size'],
            drug_vocab_size=model_info['model_architecture']['drug_vocab_size'],
            embedding_dim=model_info['model_architecture']['embedding_dim'],
            hidden_sizes=model_info['model_architecture']['hidden_sizes'],
            num_classes=model_info['model_architecture']['num_classes'],
            dropout_rate=model_info['model_architecture']['dropout_rate']
        ).to(device)
        
        # Load trained weights
        model.load_state_dict(torch.load('models/best_enhanced_drug_interaction_model.pth', map_location=device))
        model.eval()
        
        logger.info("✓ Model loaded successfully")
        logger.info(f"Model accuracy: {model_info['performance']['test_accuracy']:.4f}")
        logger.info(f"Drug vocabulary size: {preprocessor.drug_vocab_size}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return False

# Your existing prediction function remains the same
def predict_drug_combinations(drugs: List[str], dosage: Optional[float] = None) -> Dict:
    """Predict safety for all possible combinations of given drugs"""
    try:
        if len(drugs) < 2:
            return {"error": "At least 2 drugs are required for interaction analysis"}
        
        if len(drugs) > 10:
            return {"error": "Maximum 10 drugs supported per analysis"}
        
        # Clean and validate drug names
        cleaned_drugs = [drug.strip().title() for drug in drugs if drug.strip()]
        
        if len(cleaned_drugs) < 2:
            return {"error": "At least 2 valid drug names are required"}
        
        # Remove duplicates while preserving order
        seen = set()
        unique_drugs = []
        for drug in cleaned_drugs:
            if drug not in seen:
                seen.add(drug)
                unique_drugs.append(drug)
        
        logger.info(f"Analyzing safety for {len(unique_drugs)} drugs: {unique_drugs}")
        
        # Generate all possible combinations (pairs, triplets, etc.)
        all_combinations = []
        combination_results = {}
        
        for r in range(2, len(unique_drugs) + 1):
            for combo in itertools.combinations(unique_drugs, r):
                all_combinations.append(list(combo))
        
        logger.info(f"Generated {len(all_combinations)} combinations to analyze")
        
        # Helper function to predict single combination
        def predict_single_combination(drug_combo: List[str]) -> Dict:
            try:
                # Create prediction DataFrame
                prediction_data = {}
                
                # Fill drug columns
                for i in range(1, 11):  # max_drugs = 10
                    col_name = f'drug{i}'
                    if i <= len(drug_combo):
                        prediction_data[col_name] = [drug_combo[i-1]]
                    else:
                        prediction_data[col_name] = [None]
                
                # Add other features
                prediction_data['doses_per_24_hrs'] = [dosage if dosage is not None else 0.0]
                prediction_data['total_drugs'] = [len(drug_combo)]
                prediction_data['has_dosage_info'] = [1 if dosage is not None else 0]
                prediction_data['subject_id'] = [0]  # Dummy value
                prediction_data['drug_combination_id'] = ['_'.join(drug_combo)]
                
                df_pred = pd.DataFrame(prediction_data)
                
                # Transform using preprocessor
                X_pred = preprocessor.transform(df_pred)
                
                # Make prediction
                with torch.no_grad():
                    X_tensor = torch.FloatTensor(X_pred).to(device)
                    output = model(X_tensor)
                    probs = F.softmax(output, dim=1)
                    pred_class = output.argmax(dim=1).item()
                    confidence = probs[0][pred_class].item()
                
                # Convert prediction to label
                prediction = preprocessor.label_encoder.inverse_transform([pred_class])[0]
                
                return {
                    "prediction": prediction,
                    "confidence": confidence,
                    "safe_probability": probs[0][0].item(),
                    "unsafe_probability": probs[0][1].item(),
                    "drug_count": len(drug_combo)
                }
            except Exception as e:
                logger.error(f"Error predicting combination {drug_combo}: {e}")
                return {"error": str(e)}
        
        # Predict each combination
        for combo in all_combinations:
            result = predict_single_combination(combo)
            combo_key = " + ".join(combo)
            combination_results[combo_key] = result
        
        # Analyze overall safety
        safe_combinations = [k for k, v in combination_results.items() if v.get('prediction') == 'safe']
        unsafe_combinations = [k for k, v in combination_results.items() if v.get('prediction') == 'unsafe']
        error_combinations = [k for k, v in combination_results.items() if 'error' in v]
        
        overall_assessment = {
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
            "unsafe_combination_list": unsafe_combinations
        }
        
        return overall_assessment
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return {"error": f"Prediction failed: {str(e)}"}

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/predict', methods=['POST'])
def api_predict():
    """API endpoint for drug interaction prediction with enhanced logging"""
    request_start_time = datetime.utcnow()
    
    try:
        data = request.get_json()
        
        if not data:
            logger.warning("API request with no data")
            return jsonify({"error": "No data provided"}), 400
        
        drugs = data.get('drugs', [])
        dosage = data.get('dosage')
        
        logger.info(f"Prediction request: drugs={drugs}, dosage={dosage}")
        
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
        
        # Make prediction
        result = predict_drug_combinations(drugs, dosage)
        
        # Log response time
        response_time = (datetime.utcnow() - request_start_time).total_seconds() * 1000
        logger.info(f"Prediction completed in {response_time:.2f}ms")
        
        if "error" in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/health')
def health_check():
    """Enhanced health check endpoint with detailed system info"""
    try:
        # Basic health info
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "model_loaded": model is not None,
            "device": str(device) if device else None,
            "environment": os.environ.get('FLASK_ENV', 'unknown')
        }
        
        # Add model performance info if available
        if model_info:
            health_data["model_accuracy"] = model_info['performance']['test_accuracy']
            health_data["drug_vocabulary_size"] = preprocessor.drug_vocab_size if preprocessor else None
        
        # Add AWS info if available
        if s3_client:
            health_data["aws_s3_connected"] = True
            health_data["s3_bucket"] = os.environ.get('S3_BUCKET_MODELS', '')
        
        # System resource info
        try:
            import psutil
            health_data["cpu_percent"] = psutil.cpu_percent()
            health_data["memory_percent"] = psutil.virtual_memory().percent
        except ImportError:
            pass
        
        return jsonify(health_data)
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

@app.route('/api/metrics')
def metrics():
    """Prometheus-style metrics endpoint"""
    try:
        import psutil
        
        metrics_data = []
        
        # System metrics
        metrics_data.append(f"cpu_usage_percent {psutil.cpu_percent()}")
        metrics_data.append(f"memory_usage_percent {psutil.virtual_memory().percent}")
        
        # Application metrics
        metrics_data.append(f"model_loaded {1 if model is not None else 0}")
        
        if model_info:
            metrics_data.append(f"model_accuracy {model_info['performance']['test_accuracy']}")
        
        return "\n".join(metrics_data), 200, {'Content-Type': 'text/plain'}
        
    except Exception as e:
        logger.error(f"Metrics error: {e}")
        return f"# Error generating metrics: {e}", 500, {'Content-Type': 'text/plain'}

# Keep your existing demo and suggestion endpoints
@app.route('/api/demo-predictions')
def demo_predictions():
    """Demonstration endpoint showing model working correctly"""
    # Your existing demo code here
    pass

@app.route('/api/drug-suggestions')
def drug_suggestions():
    """Get drug suggestions for autocomplete"""
    # Your existing suggestion code here
    pass

if __name__ == '__main__':
    # Load model on startup
    logger.info("Loading Zaura Health Drug Interaction Model...")
    
    if not load_model():
        logger.error("Failed to load model. Please ensure model files exist.")
        sys.exit(1)
    
    logger.info("✓ Zaura Health API ready! (Powered by Z Corp.®)")
    logger.info("Access the application at: http://localhost:5000")
    
    # Run the application
    app.run(host='0.0.0.0', port=5000, debug=False)