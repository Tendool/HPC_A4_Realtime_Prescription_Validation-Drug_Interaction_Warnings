Cloud-Based Big Data Analytics System for Real-Time Prescription Validation & Drug Interaction Warnings
Team A4
	Rupali K – [CB.AI.U4AID23033]
	Mahadev S – [CB.AI.U4AID23034]
	Tendool Srivatsav S – [CB.AI.U4AID23035]
	Sarang U – [CB.AI.U4AID23036]
	Roshini A – [CB.AI.U4AID23069]
Problem Statement
Healthcare providers need a fast, reliable way to validate prescriptions in real time reading a doctor’s prescription (often handwritten), extracting drug names and dosages, checking drug drug interactions (DDIs), and validating dosage safety given standard guidelines. Traditional manual checks are slow and error-prone; relying only on static rules fails to generalize to unseen combinations.
This project builds a hybrid AI system that:
1.	Reads prescriptions via a fine-tuned OCR model (handwritten + printed),
2.	Predicts DDI risk using a deep learning model (with a rule/KB fallback),
3.	Validates dosages against guideline ranges,
4.	Serves results in real-time through a cloud API and dashboard.
The final deliverable is an end-to-end cloud pipeline with a comparative analysis of inference latency/accuracy and a website to demonstrate both this system and the Quantum Deep Learning based Multi-Modal Disease Prediction project.

Step-by-Step Procedure :
Phase 1: Data Collection & Normalization (Weeks 1–2)
1.	Assemble Data
o	Prescription images + labels (ground truth text).
o	Clinical prescriptions (e.g., MIMIC-IV tables) for validation samples.
o	Drug–drug interaction sources for training labels.
o	Dosage guideline tables
2.	Normalize & Map
o	Standardize drug identifiers (RxNorm/ATC) and unit normalization (mg, mL, IU).
3.	Storage & Access
o	Upload to Azure Blob Storage (raw) and Azure Databricks/Delta (curated).
o	Define train/val/test splits for OCR and DDI.

Phase 2: OCR Fine-Tuning & Extraction (Weeks 3–4)
1.	Model Choice & Setup
o	Start with TrOCR for speed → fine-tune on our labeled images.
o	Add data augmentation (rotation, blur, noise, perspective).
2.	Training
o	Fine-tune on image→text; evaluate with CER/WER.
o	Post-process with medical NER/regex to extract: DRUG, DOSE
3.	Validation
o	Measure field-level extraction F1 (exact match on DRUG, DOSE, FREQ).
o	Export structured JSON for downstream checks.
________________________________________
Phase 3: DDI Prediction & Dosage Validation (Weeks 5–6)
1.	DDI Model (Prediction)
o	Input: pairs/tuples of standardized drug IDs (+ optional patient context).
o	Approach: BioBERT/PubMedBERT classifier for Safe / Unsafe / Unknown; train on DDI datasets.
o	Add explainability: surface the top evidence (e.g., mechanism tags) when available.
2.	Dosage Validation (Rules)
o	Build rule tables per drug/form/route (min/max daily dose, renal/hepatic adjustments if available).
o	Compare extracted dose vs. guideline → flag underdose/overdose.
3.	Hybrid Decision Engine
o	Priority: if a DDI is in KB → show severity + rationale.
o	Else use DL prediction with calibrated confidence.
o	Combine outputs into a single Validation Report object.

Phase 4: Cloud Integration & Real-Time Serving (Weeks 7–8)
1.	Batch & Real-Time Pipelines
o	Batch preprocessing & training on Azure Databricks / Spark (for scale).
o	Real-time inference with Azure Functions/AKS + FastAPI microservice:
	Endpoint /validatePrescription accepts image or structured JSON.
	Pipeline: OCR → NER → DDI model + rules → dosage check → response.
2.	Persistence & Monitoring
o	Store inferences and flags in Azure Cosmos DB / SQL.
o	Add logging, metrics (latency, error rate), and basic alerting.
3.	Dashboard
o	Minimal clinician view (Streamlit/React): uploaded prescription, extracted fields, warnings, recommendations, timestamps.
  
Phase 5: Testing, Website & Finalization (Week 9)
1.	End-to-End Evaluation
o	Metrics: OCR (CER/WER), Extraction F1, DDI accuracy/F1, dosage error detection rate, p95 latency.
o	Test with varied prescriptions (handwritten/printed), polypharmacy cases, noisy images.
2.	Performance & Ablations
o	Compare rule-only vs. DL + rule hybrid on precision/recall of unsafe flags.
o	Report cloud inference latency before/after optimizations (batch size, model quantization if used).
3.	Website (2 Days)
o	Build a website to demonstrate this project and mention the Quantum Deep Learning based Multi-Modal Disease Prediction project.
o	Basic pages: Home, Upload & Validate (demo), Results/Examples, About/Team.
4.	Packaging
o	Final report, API docs (OpenAPI/Swagger), architecture diagram, and demo script.

Deliverables
•	Fine-tuned OCR model + extraction pipeline.
•	DDI prediction model + dosage rules engine.
•	Real-time cloud API & minimal dashboard.
•	Evaluation report (accuracy, latency, ablations).
•	Website (demo integration; 2 days in Week 9).

