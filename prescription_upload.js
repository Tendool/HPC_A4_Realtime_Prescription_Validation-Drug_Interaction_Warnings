// Prescription Upload JavaScript
// Handles file upload, preview, and analysis functionality

class PrescriptionUpload {
    constructor() {
        this.currentFile = null;
        this.isAnalyzing = false;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.browseBtn = document.getElementById('browseBtn');
        this.uploadPlaceholder = document.getElementById('uploadPlaceholder');

        // Preview elements
        this.imagePreview = document.getElementById('imagePreview');
        this.previewImg = document.getElementById('previewImg');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.removeImageBtn = document.getElementById('removeImage');

        // Options and buttons
        this.processingOptions = document.getElementById('processingOptions');
        this.actionButtons = document.getElementById('actionButtons');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.resetBtn = document.getElementById('resetBtn');

        // Results elements
        this.resultsSection = document.getElementById('resultsSection');
        this.drugsCount = document.getElementById('drugsCount');
        this.dosagesCount = document.getElementById('dosagesCount');
        this.extractedDrugs = document.getElementById('extractedDrugs');
        this.riskSummary = document.getElementById('riskSummary');
        this.detailedInteractions = document.getElementById('detailedInteractions');
        this.recommendationList = document.getElementById('recommendationList');

        // Options checkboxes
        this.extractDrugsCheck = document.getElementById('extractDrugs');
        this.extractDosagesCheck = document.getElementById('extractDosages');
        this.checkInteractionsCheck = document.getElementById('checkInteractions');
        this.generateReportCheck = document.getElementById('generateReport');
    }

    setupEventListeners() {
        // File upload events
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Button events
        this.removeImageBtn.addEventListener('click', () => this.removeImage());
        this.analyzeBtn.addEventListener('click', () => this.analyzeImage());
        this.resetBtn.addEventListener('click', () => this.reset());

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDragOver(e) {
        this.preventDefaults(e);
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(e) {
        this.preventDefaults(e);
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(e) {
        this.preventDefaults(e);
        this.uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('Please select a valid image file (JPG, PNG, GIF) or PDF.');
            return;
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            this.showError('File size must be less than 10MB.');
            return;
        }

        this.currentFile = file;
        this.showImagePreview(file);
        this.showProcessingOptions();
        this.showActionButtons();
    }

    showImagePreview(file) {
        // Hide upload placeholder
        this.uploadPlaceholder.style.display = 'none';
        
        // Show preview
        this.imagePreview.style.display = 'block';
        
        // Set file info
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        
        // Create image preview (only for image files)
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImg.src = e.target.result;
                this.previewImg.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            // For PDF files, show a placeholder
            this.previewImg.style.display = 'none';
        }
    }

    showProcessingOptions() {
        this.processingOptions.style.display = 'block';
    }

    showActionButtons() {
        this.actionButtons.style.display = 'flex';
    }

    removeImage() {
        this.currentFile = null;
        this.reset();
    }

    reset() {
        // Hide all sections
        this.imagePreview.style.display = 'none';
        this.processingOptions.style.display = 'none';
        this.actionButtons.style.display = 'none';
        this.resultsSection.style.display = 'none';
        
        // Show upload placeholder
        this.uploadPlaceholder.style.display = 'flex';
        
        // Clear file input
        this.fileInput.value = '';
        
        // Reset form state
        this.currentFile = null;
        this.isAnalyzing = false;
        
        // Reset loading state
        this.setAnalyzeButtonLoading(false);
        
        // Clear results
        this.clearResults();
    }

    async analyzeImage() {
        if (!this.currentFile || this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = true;
        this.setAnalyzeButtonLoading(true);

        try {
            // Get selected options
            const options = {
                extractDrugs: this.extractDrugsCheck.checked,
                extractDosages: this.extractDosagesCheck.checked,
                checkInteractions: this.checkInteractionsCheck.checked,
                generateReport: this.generateReportCheck.checked
            };

            // Create form data
            const formData = new FormData();
            formData.append('prescription_image', this.currentFile);
            formData.append('options', JSON.stringify(options));

            // Make API request
            const response = await fetch('/api/analyze_prescription', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.displayResults(result.data);
            } else {
                throw new Error(result.message || 'Analysis failed');
            }

        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('Analysis failed: ' + error.message);
            
            // Show placeholder results for demo
            this.showPlaceholderResults();
        } finally {
            this.isAnalyzing = false;
            this.setAnalyzeButtonLoading(false);
        }
    }

    setAnalyzeButtonLoading(loading) {
        const spinner = this.analyzeBtn.querySelector('.loading-spinner');
        const text = this.analyzeBtn.querySelector('span');
        
        if (loading) {
            this.analyzeBtn.disabled = true;
            spinner.style.display = 'block';
            text.textContent = 'Analyzing...';
        } else {
            this.analyzeBtn.disabled = false;
            spinner.style.display = 'none';
            text.textContent = 'Analyze Prescription';
        }
    }

    displayResults(data) {
        // Show results section
        this.resultsSection.style.display = 'block';
        
        // Populate OCR results
        if (data.extracted_drugs) {
            this.displayExtractedDrugs(data.extracted_drugs);
        }
        
        // Populate interaction analysis
        if (data.interactions) {
            this.displayInteractionAnalysis(data.interactions);
        }
        
        // Populate recommendations
        if (data.recommendations) {
            this.displayRecommendations(data.recommendations);
        }
        
        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    displayExtractedDrugs(drugs) {
        this.drugsCount.textContent = drugs.length;
        this.dosagesCount.textContent = drugs.filter(drug => drug.dosage).length;
        
        this.extractedDrugs.innerHTML = '';
        drugs.forEach(drug => {
            const drugElement = document.createElement('div');
            drugElement.className = 'drug-item';
            drugElement.innerHTML = `
                <span class="drug-name">${drug.name}</span>
                <span class="drug-dosage">${drug.dosage || 'Dosage not detected'}</span>
            `;
            this.extractedDrugs.appendChild(drugElement);
        });
    }

    displayInteractionAnalysis(interactions) {
        // Display risk summary
        this.riskSummary.innerHTML = `
            <div class="risk-level ${interactions.overall_risk.toLowerCase()}">
                <h4>Overall Risk: ${interactions.overall_risk}</h4>
                <p>${interactions.summary}</p>
            </div>
        `;
        
        // Display detailed interactions
        this.detailedInteractions.innerHTML = '';
        interactions.details.forEach(interaction => {
            const interactionElement = document.createElement('div');
            interactionElement.className = `interaction-item ${interaction.severity.toLowerCase()}`;
            interactionElement.innerHTML = `
                <h5>${interaction.drug_pair}</h5>
                <p><strong>Severity:</strong> ${interaction.severity}</p>
                <p>${interaction.description}</p>
            `;
            this.detailedInteractions.appendChild(interactionElement);
        });
    }

    displayRecommendations(recommendations) {
        this.recommendationList.innerHTML = '';
        recommendations.forEach(recommendation => {
            const recElement = document.createElement('div');
            recElement.className = `recommendation-item ${recommendation.type}`;
            recElement.innerHTML = `
                <div class="recommendation-icon">
                    <i class="fas ${this.getRecommendationIcon(recommendation.type)}"></i>
                </div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${recommendation.title}</div>
                    <div class="recommendation-text">${recommendation.text}</div>
                </div>
            `;
            this.recommendationList.appendChild(recElement);
        });
    }

    getRecommendationIcon(type) {
        const icons = {
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'danger': 'fa-exclamation-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    showPlaceholderResults() {
        // Show placeholder results while OCR is being developed
        this.resultsSection.style.display = 'block';
        
        // Mock extracted drugs
        const mockDrugs = [
            { name: 'Aspirin', dosage: '81mg' },
            { name: 'Metformin', dosage: '500mg' },
            { name: 'Lisinopril', dosage: '10mg' }
        ];
        
        this.displayExtractedDrugs(mockDrugs);
        
        // Mock interaction analysis
        const mockInteractions = {
            overall_risk: 'LOW',
            summary: 'No significant drug interactions detected in this prescription.',
            details: []
        };
        
        this.displayInteractionAnalysis(mockInteractions);
        
        // Mock recommendations
        const mockRecommendations = [
            {
                type: 'info',
                title: 'OCR Development in Progress',
                text: 'This is placeholder data. The actual OCR system is being developed to extract real prescription information.'
            },
            {
                type: 'info',
                title: 'Monitor Blood Pressure',
                text: 'With Lisinopril therapy, regular blood pressure monitoring is recommended.'
            }
        ];
        
        this.displayRecommendations(mockRecommendations);
        
        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    clearResults() {
        this.drugsCount.textContent = '-';
        this.dosagesCount.textContent = '-';
        this.extractedDrugs.innerHTML = '';
        this.riskSummary.innerHTML = '';
        this.detailedInteractions.innerHTML = '';
        this.recommendationList.innerHTML = '';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showError(message) {
        // Create or update error message
        let errorDiv = document.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            this.uploadArea.parentNode.insertBefore(errorDiv, this.uploadArea.nextSibling);
        }
        
        errorDiv.innerHTML = `
            <div class="alert alert-error">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
                <button type="button" class="close-btn" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize prescription upload functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('uploadArea')) {
        new PrescriptionUpload();
    }
});

// Add error message styles if not already present
const style = document.createElement('style');
style.textContent = `
.error-message {
    margin-top: 1rem;
}

.alert {
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
}

.alert-error {
    background: var(--unsafe-light, #fef2f2);
    color: var(--unsafe-color, #dc2626);
    border: 1px solid var(--unsafe-color, #dc2626);
}

.close-btn {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    margin-left: auto;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
}
`;
document.head.appendChild(style);