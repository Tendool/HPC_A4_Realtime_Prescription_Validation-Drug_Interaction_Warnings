#!/usr/bin/env python3
"""
Zaura Health - Batch Testing Script
Test multiple drug combinations programmatically
"""

import requests
import json
import time

# Test combinations with expected results
TEST_CASES = [
    # 2-Drug SAFE Combinations
    {
        "name": "Aspirin + Metformin",
        "drugs": ["aspirin", "metformin"],
        "dosages": ["81mg", "500mg"],
        "expected": "safe",
        "description": "Low-dose aspirin with diabetes medication"
    },
    {
        "name": "Lisinopril + Amlodipine",
        "drugs": ["lisinopril", "amlodipine"],
        "dosages": ["10mg", "5mg"],
        "expected": "safe",
        "description": "Common hypertension combination"
    },
    {
        "name": "Omeprazole + Levothyroxine",
        "drugs": ["omeprazole", "levothyroxine"],
        "dosages": ["20mg", "100mcg"],
        "expected": "safe",
        "description": "PPI with thyroid hormone (with proper timing)"
    },
    {
        "name": "Simvastatin + Ezetimibe",
        "drugs": ["simvastatin", "ezetimibe"],
        "dosages": ["20mg", "10mg"],
        "expected": "safe",
        "description": "Cholesterol management combination"
    },
    {
        "name": "Acetaminophen + Ibuprofen",
        "drugs": ["acetaminophen", "ibuprofen"],
        "dosages": ["500mg", "200mg"],
        "expected": "safe",
        "description": "Alternating pain relief"
    },
    
    # 2-Drug UNSAFE Combinations
    {
        "name": "Warfarin + Aspirin (High-dose)",
        "drugs": ["warfarin", "aspirin"],
        "dosages": ["5mg", "325mg"],
        "expected": "unsafe",
        "description": "Double anticoagulation - bleeding risk"
    },
    {
        "name": "Metformin + Glyburide (High doses)",
        "drugs": ["metformin", "glyburide"],
        "dosages": ["1000mg", "10mg"],
        "expected": "unsafe",
        "description": "Severe hypoglycemia risk"
    },
    {
        "name": "Sildenafil + Nitroglycerin",
        "drugs": ["sildenafil", "nitroglycerin"],
        "dosages": ["100mg", "0.4mg"],
        "expected": "unsafe",
        "description": "Dangerous hypotension"
    },
    {
        "name": "Lithium + Furosemide",
        "drugs": ["lithium", "furosemide"],
        "dosages": ["600mg", "80mg"],
        "expected": "unsafe",
        "description": "Lithium toxicity risk"
    },
    {
        "name": "Digoxin + Amiodarone",
        "drugs": ["digoxin", "amiodarone"],
        "dosages": ["0.25mg", "200mg"],
        "expected": "unsafe",
        "description": "Digoxin toxicity"
    },
    
    # 3-Drug SAFE Combinations
    {
        "name": "Triple Hypertension Therapy",
        "drugs": ["lisinopril", "amlodipine", "hydrochlorothiazide"],
        "dosages": ["10mg", "5mg", "12.5mg"],
        "expected": "safe",
        "description": "Standard triple therapy for hypertension"
    },
    {
        "name": "Triple Diabetes Therapy",
        "drugs": ["metformin", "glipizide", "pioglitazone"],
        "dosages": ["500mg", "5mg", "15mg"],
        "expected": "safe",
        "description": "Moderate-dose diabetes triple therapy"
    },
    {
        "name": "Post-Cardiac Event Therapy",
        "drugs": ["aspirin", "clopidogrel", "atorvastatin"],
        "dosages": ["81mg", "75mg", "20mg"],
        "expected": "safe",
        "description": "Standard post-MI therapy"
    },
    
    # 3-Drug UNSAFE Combinations
    {
        "name": "Triple Anticoagulation",
        "drugs": ["warfarin", "aspirin", "clopidogrel"],
        "dosages": ["5mg", "325mg", "75mg"],
        "expected": "unsafe",
        "description": "Extreme bleeding risk"
    },
    {
        "name": "Serotonin Syndrome Risk",
        "drugs": ["tramadol", "sertraline", "sumatriptan"],
        "dosages": ["100mg", "100mg", "100mg"],
        "expected": "unsafe",
        "description": "Multiple serotonergic agents"
    },
    {
        "name": "Multiple Cardiac Toxicity",
        "drugs": ["digoxin", "amiodarone", "furosemide"],
        "dosages": ["0.25mg", "200mg", "40mg"],
        "expected": "unsafe",
        "description": "Multiple toxicity mechanisms"
    },
    
    # 4-Drug Combinations
    {
        "name": "Comprehensive CV + Diabetes Management",
        "drugs": ["lisinopril", "metformin", "atorvastatin", "aspirin"],
        "dosages": ["10mg", "500mg", "20mg", "81mg"],
        "expected": "safe",
        "description": "Standard comprehensive therapy"
    },
    {
        "name": "H. Pylori Eradication",
        "drugs": ["omeprazole", "clarithromycin", "amoxicillin", "bismuth"],
        "dosages": ["20mg", "500mg", "1000mg", "525mg"],
        "expected": "safe",
        "description": "Standard quadruple therapy"
    },
    {
        "name": "Multiple Warfarin Interactions",
        "drugs": ["warfarin", "aspirin", "phenytoin", "rifampin"],
        "dosages": ["5mg", "325mg", "300mg", "600mg"],
        "expected": "unsafe",
        "description": "Multiple CYP interactions with warfarin"
    },
    {
        "name": "Severe Serotonin Syndrome",
        "drugs": ["tramadol", "fluoxetine", "linezolid", "dextromethorphan"],
        "dosages": ["100mg", "40mg", "600mg", "30mg"],
        "expected": "unsafe",
        "description": "Multiple serotonergic agents - high risk"
    }
]

def test_drug_combination(base_url, drugs, dosages, session_cookies=None):
    """Test a single drug combination"""
    try:
        # Prepare the data
        data = {
            "drugs": drugs,
            "dosages": {f"dosage_{i+1}": dosages[i] for i in range(len(drugs))}
        }
        
        # Make the request
        response = requests.post(
            f"{base_url}/analyze",
            json=data,
            cookies=session_cookies,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"HTTP {response.status_code}"}
            
    except Exception as e:
        return {"error": str(e)}

def login_and_get_session(base_url, username, password):
    """Login and get session cookies"""
    try:
        login_data = {
            "username": username,
            "password": password
        }
        
        response = requests.post(
            f"{base_url}/login",
            json=login_data,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.cookies
        else:
            return None
            
    except Exception as e:
        print(f"Login failed: {e}")
        return None

def run_batch_tests(base_url="http://localhost:5000"):
    """Run all test cases"""
    print("🧪 Zaura Health - Batch Testing Suite")
    print("=" * 60)
    
    # Login as doctor
    print("🔐 Logging in as doctor...")
    session_cookies = login_and_get_session(base_url, "dr_smith", "doctor123")
    
    if not session_cookies:
        print("❌ Login failed. Make sure the server is running.")
        return
    
    print("✅ Login successful!")
    print()
    
    # Test results
    results = {
        "total": len(TEST_CASES),
        "passed": 0,
        "failed": 0,
        "errors": 0
    }
    
    # Run each test case
    for i, test_case in enumerate(TEST_CASES, 1):
        print(f"Test {i:2d}/{len(TEST_CASES)}: {test_case['name']}")
        print(f"         Drugs: {', '.join(test_case['drugs'])}")
        print(f"      Dosages: {', '.join(test_case['dosages'])}")
        print(f"     Expected: {test_case['expected'].upper()}")
        
        # Run the test
        result = test_drug_combination(
            base_url, 
            test_case['drugs'], 
            test_case['dosages'],
            session_cookies
        )
        
        if "error" in result:
            print(f"        Result: ❌ ERROR - {result['error']}")
            results["errors"] += 1
        else:
            predicted = result.get("prediction", "unknown").lower()
            expected = test_case["expected"].lower()
            
            if predicted == expected:
                print(f"        Result: ✅ PASS - Predicted {predicted.upper()}")
                results["passed"] += 1
            else:
                print(f"        Result: ❌ FAIL - Expected {expected.upper()}, got {predicted.upper()}")
                results["failed"] += 1
                
                # Show additional details for failures
                if "safety_score" in result:
                    print(f"                   Safety Score: {result['safety_score']:.3f}")
                if "explanation" in result:
                    print(f"                   Explanation: {result['explanation']}")
        
        print(f"   Description: {test_case['description']}")
        print()
        
        # Brief pause between tests
        time.sleep(0.5)
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print(f"Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']} ({results['passed']/results['total']*100:.1f}%)")
    print(f"❌ Failed: {results['failed']} ({results['failed']/results['total']*100:.1f}%)")
    print(f"🔥 Errors: {results['errors']} ({results['errors']/results['total']*100:.1f}%)")
    
    # Accuracy assessment
    if results["total"] > 0:
        accuracy = results["passed"] / (results["total"] - results["errors"]) * 100
        print(f"🎯 Accuracy: {accuracy:.1f}%")
        
        if accuracy >= 80:
            print("🏆 Excellent model performance!")
        elif accuracy >= 70:
            print("👍 Good model performance")
        elif accuracy >= 60:
            print("⚠️  Moderate performance - consider model improvements")
        else:
            print("🚨 Poor performance - model needs significant improvement")

if __name__ == "__main__":
    import sys
    
    # Allow custom server URL
    server_url = "http://localhost:5000"
    if len(sys.argv) > 1:
        server_url = sys.argv[1]
    
    print(f"Testing server: {server_url}")
    print("Make sure the Zaura Health server is running!")
    print()
    
    # Wait a moment for user to confirm
    input("Press Enter to start testing... (Ctrl+C to cancel)")
    print()
    
    run_batch_tests(server_url)