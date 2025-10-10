/**
 * Zaura Health - Enhanced Interactive JavaScript Application
 * Fixed version with proper drug input handling and form submission
 * Professional drug interaction analysis interface by Z Corp.®
 */

class ZauraHealthApp {
    constructor() {
        this.drugCount = 2;
        this.minDrugs = 2;
        this.maxDrugs = 10;
        this.isAnalyzing = false;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.initializeTheme();
        
        // Check API health on load
        this.checkAPIHealth();
        
        console.log('🚀 Z Corp.® Application initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Form submission
        const form = document.getElementById('analysisForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleAnalysis(e));
        }

        // Add drug button
        const addDrugBtn = document.getElementById('addDrugBtn');
        if (addDrugBtn) {
            addDrugBtn.addEventListener('click', () => this.addDrugInput());
        }

        // Remove drug button
        const removeDrugBtn = document.getElementById('removeDrugBtn');
        if (removeDrugBtn) {
            removeDrugBtn.addEventListener('click', () => this.removeDrugInput());
        }

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Help button
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openModal('helpModal'));
        }

        // Modal close buttons
        const modalCloses = document.querySelectorAll('.modal-close');
        modalCloses.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Setup drug input suggestions for existing inputs
        this.setupExistingDrugInputs();
    }

    /**
     * Setup existing drug inputs with autocomplete and validation
     */
    setupExistingDrugInputs() {
        const existingInputs = document.querySelectorAll('input[name="drugs[]"]');
        existingInputs.forEach(input => {
            this.setupDrugInputEvents(input);
        });
        this.updateButtonStates();
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to analyze
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleAnalysis(e);
            }
            
            // Ctrl/Cmd + Plus to add drug
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                this.addDrugInput();
            }
        });
    }

    /**
     * Add a new drug input field
     */
    addDrugInput() {
        if (this.drugCount >= this.maxDrugs) {
            this.showError(`Maximum ${this.maxDrugs} drugs supported per analysis`);
            return;
        }

        const drugsGrid = document.getElementById('drugsGrid');
        if (!drugsGrid) return;

        this.drugCount++;

        const drugInputGroup = document.createElement('div');
        drugInputGroup.className = 'drug-input-group';

        drugInputGroup.innerHTML = `
            <label for="drug${this.drugCount}">Drug ${this.drugCount} *</label>
            <div class="input-with-suggestions">
                <input type="text" 
                       id="drug${this.drugCount}" 
                       name="drugs[]" 
                       placeholder="Enter drug name..." 
                       required>
                <div class="suggestions-dropdown" id="suggestions${this.drugCount}"></div>
            </div>
            <input type="number" 
                   name="dosages[]" 
                   placeholder="Dosage (mg/24h)" 
                   min="0" 
                   step="0.1" 
                   class="dosage-input">
        `;

        drugsGrid.appendChild(drugInputGroup);

        // Setup events for the new input
        const newInput = drugInputGroup.querySelector('input[name="drugs[]"]');
        if (newInput) {
            newInput.focus();
            this.setupDrugInputEvents(newInput);
        }

        this.updateButtonStates();
        this.animateElement(drugInputGroup, 'slideInUp');
    }

    /**
     * Remove the last drug input field
     */
    removeDrugInput() {
        if (this.drugCount <= this.minDrugs) {
            this.showError(`Minimum ${this.minDrugs} drugs required for analysis`);
            return;
        }

        const drugsGrid = document.getElementById('drugsGrid');
        if (!drugsGrid) return;

        const lastInputGroup = drugsGrid.lastElementChild;
        if (lastInputGroup) {
            this.animateElement(lastInputGroup, 'slideOutUp', () => {
                lastInputGroup.remove();
                this.drugCount--;
                this.updateButtonStates();
            });
        }
    }

    /**
     * Update button states based on current drug count
     */
    updateButtonStates() {
        const addBtn = document.getElementById('addDrugBtn');
        const removeBtn = document.getElementById('removeDrugBtn');

        if (addBtn) {
            if (this.drugCount >= this.maxDrugs) {
                addBtn.disabled = true;
                addBtn.innerHTML = '<i class="fas fa-ban"></i> Maximum Drugs Reached';
            } else {
                addBtn.disabled = false;
                addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Drug';
            }
        }

        if (removeBtn) {
            if (this.drugCount <= this.minDrugs) {
                removeBtn.style.display = 'none';
            } else {
                removeBtn.style.display = 'inline-flex';
            }
        }
    }

    /**
     * Setup events for drug input fields
     */
    setupDrugInputEvents(input) {
        // Real-time validation
        input.addEventListener('input', () => {
            this.validateDrugInput(input);
            this.fetchDrugSuggestions(input);
        });

        // Enter key to add new drug
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                this.addDrugInput();
            }
        });

        // Focus events for suggestions
        input.addEventListener('focus', () => {
            if (input.value.trim()) {
                this.fetchDrugSuggestions(input);
            }
        });

        input.addEventListener('blur', () => {
            // Hide suggestions after delay to allow click
            setTimeout(() => {
                this.hideDrugSuggestions(input);
            }, 200);
        });
    }

    /**
     * Validate drug input
     */
    validateDrugInput(input) {
        const value = input.value.trim();
        
        // Remove existing validation classes
        input.classList.remove('valid', 'invalid');
        
        if (value.length === 0) {
            return;
        }
        
        if (value.length < 2) {
            input.classList.add('invalid');
            return;
        }
        
        // Check for valid drug name pattern (letters, spaces, hyphens)
        const validPattern = /^[a-zA-Z\s\-]+$/;
        if (!validPattern.test(value)) {
            input.classList.add('invalid');
            return;
        }
        
        input.classList.add('valid');
    }

    /**
     * Fetch drug suggestions from API
     */
    async fetchDrugSuggestions(input) {
        const query = input.value.trim();
        if (query.length < 2) {
            this.hideDrugSuggestions(input);
            return;
        }

        try {
            const response = await fetch(`/api/drug-suggestions?q=${encodeURIComponent(query)}`);
            const suggestions = await response.json();
            this.showDrugSuggestions(input, suggestions);
        } catch (error) {
            console.error('Error fetching drug suggestions:', error);
        }
    }

    /**
     * Show drug suggestions dropdown
     */
    showDrugSuggestions(input, suggestions) {
        const inputContainer = input.closest('.input-with-suggestions');
        const dropdown = inputContainer.querySelector('.suggestions-dropdown');
        
        if (!dropdown || suggestions.length === 0) {
            this.hideDrugSuggestions(input);
            return;
        }

        dropdown.innerHTML = '';
        suggestions.forEach(drug => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = drug;
            
            suggestionItem.addEventListener('click', () => {
                input.value = drug;
                this.validateDrugInput(input);
                this.hideDrugSuggestions(input);
            });
            
            dropdown.appendChild(suggestionItem);
        });

        dropdown.style.display = 'block';
    }

    /**
     * Hide drug suggestions dropdown
     */
    hideDrugSuggestions(input) {
        const inputContainer = input.closest('.input-with-suggestions');
        const dropdown = inputContainer.querySelector('.suggestions-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    /**
     * Handle analysis form submission
     */
    async handleAnalysis(event) {
        event.preventDefault();
        
        if (this.isAnalyzing) {
            return;
        }

        // Collect and validate data
        const analysisData = this.collectAnalysisData();
        if (!analysisData) {
            return;
        }

        // Show loading state
        this.setAnalyzingState(true);
        this.hideResults();
        this.hideError();

        try {
            // Make API request
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(analysisData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            // Display results
            this.displayResults(data);
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(error.message || 'An error occurred during analysis');
        } finally {
            this.setAnalyzingState(false);
        }
    }

    /**
     * Collect analysis data from form
     */
    collectAnalysisData() {
        const drugInputs = document.querySelectorAll('input[name="drugs[]"]');
        const dosageInputs = document.querySelectorAll('input[name="dosages[]"]');

        // Collect drug names
        const drugs = [];
        const dosages = [];
        const invalidInputs = [];

        drugInputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value) {
                if (value.length < 2) {
                    invalidInputs.push(input);
                    return;
                }
                drugs.push(value);
                
                // Get corresponding dosage
                const dosageInput = dosageInputs[index];
                if (dosageInput && dosageInput.value) {
                    const dosageValue = parseFloat(dosageInput.value);
                    if (dosageValue >= 0) {
                        dosages.push(dosageValue);
                    } else {
                        dosages.push(null);
                    }
                } else {
                    dosages.push(null);
                }
            }
        });

        // Validation
        if (drugs.length < this.minDrugs) {
            this.showError(`Please enter at least ${this.minDrugs} drug names`);
            return null;
        }

        if (invalidInputs.length > 0) {
            this.showError('Please check drug names - they should be at least 2 characters long');
            invalidInputs[0].focus();
            return null;
        }

        // Remove duplicates
        const uniqueDrugs = [...new Set(drugs.map(drug => drug.toLowerCase()))]
            .map(drug => drugs.find(d => d.toLowerCase() === drug));

        if (uniqueDrugs.length !== drugs.length) {
            this.showError('Please remove duplicate drug names');
            return null;
        }

        return {
            drugs: uniqueDrugs,
            dosages: dosages.filter(d => d !== null).length > 0 ? dosages : undefined
        };
    }

    /**
     * Set analyzing state
     */
    setAnalyzingState(analyzing) {
        this.isAnalyzing = analyzing;
        const analyzeBtn = document.getElementById('analyzeBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        if (analyzeBtn) {
            analyzeBtn.disabled = analyzing;
            if (analyzing) {
                analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
            } else {
                analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze Interactions';
            }
        }

        if (loadingOverlay) {
            if (analyzing) {
                loadingOverlay.style.display = 'flex';
            } else {
                loadingOverlay.style.display = 'none';
            }
        }
    }

    /**
     * Display analysis results
     */
    displayResults(data) {
        const resultsSection = document.getElementById('resultsSection');
        if (!resultsSection) return;

        // Update overall safety
        this.displayOverallSafety(data);
        
        // Display safety score
        this.displaySafetyScore(data);
        
        // Display dosage analysis
        this.displayDosageAnalysis(data);
        
        // Display interaction details
        this.displayInteractionDetails(data);
        
        // Display recommendations
        this.displayRecommendations(data);

        // Show results section
        resultsSection.style.display = 'block';
        
        // Smooth scroll to results
        resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    /**
     * Display overall safety status
     */
    displayOverallSafety(data) {
        const container = document.getElementById('overallSafety');
        if (!container) return;

        const isSafe = data.overall_safety === 'SAFE';
        const statusClass = isSafe ? 'safe' : 'unsafe';
        const icon = isSafe ? 'fa-shield-alt' : 'fa-exclamation-triangle';

        container.innerHTML = `
            <div class="safety-status ${statusClass}">
                <i class="fas ${icon}"></i>
                <span>Overall Status: ${data.overall_safety}</span>
            </div>
            <p class="safety-summary">
                ${isSafe 
                    ? 'No dangerous interactions detected between the analyzed drugs.'
                    : `⚠️ Potential dangerous interactions detected. ${data.unsafe_combinations} combination(s) may be unsafe.`
                }
            </p>
        `;
    }

    /**
     * Display safety score circle
     */
    displaySafetyScore(data) {
        const scoreCircle = document.getElementById('safetyScoreCircle');
        const scoreText = document.getElementById('scoreText');
        const scoreDescription = document.getElementById('scoreDescription');
        
        if (!scoreCircle || !scoreText || !scoreDescription) return;

        const scorePercentage = Math.round(data.safety_score * 100);
        
        // Animate the circular progress
        const circumference = 2 * Math.PI * 45; // radius = 45
        const offset = circumference - (scorePercentage / 100) * circumference;
        
        scoreText.textContent = `${scorePercentage}%`;
        scoreDescription.textContent = `${data.safe_combinations} safe, ${data.unsafe_combinations} unsafe combinations`;
        
        // Add CSS for the circle animation
        this.animateScoreCircle(scorePercentage);
    }

    /**
     * Animate safety score circle
     */
    animateScoreCircle(percentage) {
        const circle = document.querySelector('.safety-score-circle');
        if (!circle) return;
        
        // Create or update the CSS for the circular progress
        const style = document.createElement('style');
        style.textContent = `
            .safety-score-circle::after {
                content: '';
                position: absolute;
                width: 90px;
                height: 90px;
                border-radius: 50%;
                border: 8px solid #e5e7eb;
                border-top: 8px solid ${percentage >= 70 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444'};
                transform: rotate(${(percentage / 100) * 360 - 90}deg);
                transition: transform 1s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Display dosage analysis
     */
    displayDosageAnalysis(data) {
        const container = document.getElementById('dosageAnalysis');
        const grid = document.getElementById('dosageGrid');
        
        if (!container || !grid || !data.dosage_analysis) return;

        let html = '';
        Object.entries(data.dosage_analysis).forEach(([drug, analysis]) => {
            const safetyClass = analysis.safety_level === 'safe' ? 'safe' : 
                               analysis.safety_level === 'warning' ? 'warning' : 'danger';
            
            html += `
                <div class="dosage-item ${safetyClass}">
                    <div class="drug-name">${drug}</div>
                    <div class="dosage-amount">${analysis.dosage}mg/24h</div>
                    <div class="safety-level">${analysis.safety_level.toUpperCase()}</div>
                    <div class="safety-message">${analysis.message}</div>
                </div>
            `;
        });

        grid.innerHTML = html;
        container.style.display = html ? 'block' : 'none';
    }

    /**
     * Display interaction details
     */
    displayInteractionDetails(data) {
        const container = document.getElementById('combinationsGrid');
        if (!container) return;

        let html = '';
        
        // Sort combinations by safety (unsafe first, then by confidence)
        const combinations = Object.entries(data.detailed_results || {}).sort(([, a], [, b]) => {
            if (a.prediction !== b.prediction) {
                return a.prediction === 'unsafe' ? -1 : 1;
            }
            return b.confidence - a.confidence;
        });

        combinations.forEach(([combination, result]) => {
            if (result.error) {
                html += `
                    <div class="combination-card error">
                        <div class="combination-header">
                            <span class="combination-name">${combination}</span>
                            <span class="status-badge error">ERROR</span>
                        </div>
                        <div class="combination-details">
                            <p>Error: ${result.error}</p>
                        </div>
                    </div>
                `;
                return;
            }

            const isSafe = result.prediction === 'safe';
            const statusClass = isSafe ? 'safe' : 'unsafe';
            const confidencePercentage = Math.round(result.confidence * 100);

            html += `
                <div class="combination-card ${statusClass}">
                    <div class="combination-header">
                        <span class="combination-name">${combination}</span>
                        <span class="status-badge ${statusClass}">${result.prediction.toUpperCase()}</span>
                    </div>
                    <div class="combination-details">
                        <div class="confidence-bar">
                            <span>Confidence: ${confidencePercentage}%</span>
                            <div class="confidence-fill" style="width: ${confidencePercentage}%"></div>
                        </div>
                        <div class="drug-count">${result.drug_count} drugs</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Display recommendations
     */
    displayRecommendations(data) {
        const container = document.getElementById('recommendationsList');
        if (!container) return;

        let recommendations = [];

        if (data.overall_safety === 'UNSAFE') {
            recommendations.push({
                type: 'warning',
                icon: 'fa-exclamation-triangle',
                title: 'Consult Healthcare Provider',
                text: 'Unsafe drug combinations detected. Please consult with a healthcare professional before taking these medications together.'
            });
        }

        if (data.safety_score < 0.8) {
            recommendations.push({
                type: 'caution',
                icon: 'fa-info-circle',
                title: 'Monitor for Side Effects',
                text: 'Some combinations show moderate risk. Monitor for unusual symptoms and report any concerns to your doctor.'
            });
        }

        if (data.overall_dosage_risk && data.overall_dosage_risk !== 'safe') {
            recommendations.push({
                type: 'warning',
                icon: 'fa-pills',
                title: 'Dosage Concerns',
                text: `Dosage levels are ${data.overall_dosage_risk}. Consider reviewing medication dosages with your healthcare provider.`
            });
        }

        recommendations.push({
            type: 'info',
            icon: 'fa-user-md',
            title: 'Professional Medical Advice',
            text: 'This AI analysis is for informational purposes only. Always consult qualified healthcare professionals for medical decisions.'
        });

        let html = '';
        recommendations.forEach(rec => {
            html += `
                <div class="recommendation-card ${rec.type}">
                    <div class="recommendation-icon">
                        <i class="fas ${rec.icon}"></i>
                    </div>
                    <div class="recommendation-content">
                        <h4>${rec.title}</h4>
                        <p>${rec.text}</p>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Hide results section
     */
    hideResults() {
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Create or show error alert
        let errorAlert = document.getElementById('errorAlert');
        
        if (!errorAlert) {
            errorAlert = document.createElement('div');
            errorAlert.id = 'errorAlert';
            errorAlert.className = 'error-alert';
            
            errorAlert.innerHTML = `
                <div class="error-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span id="errorMessage">${message}</span>
                    <button class="error-close" onclick="window.hideError()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            document.body.appendChild(errorAlert);
        } else {
            document.getElementById('errorMessage').textContent = message;
        }
        
        errorAlert.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideError(), 5000);
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorAlert = document.getElementById('errorAlert');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }

    /**
     * Check API health
     */
    async checkAPIHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            if (data.status === 'healthy' && data.model_loaded) {
                console.log('✅ API Health Check: Model loaded successfully');
                console.log(`📊 Model Accuracy: ${data.accuracy}`);
                
                // Update UI with model info
                document.getElementById('accuracyRate').textContent = `${Math.round(data.accuracy * 100)}%`;
                document.getElementById('drugVocabulary').textContent = data.drug_vocabulary_size.toLocaleString();
            } else {
                console.warn('⚠️ API Health Check: Issues detected');
                this.showError('Model not properly loaded. Some features may not work correctly.');
            }
        } catch (error) {
            console.error('❌ API Health Check failed:', error);
            this.showError('Cannot connect to analysis server. Please check your connection.');
        }
    }

    /**
     * Open modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    /**
     * Initialize theme system
     */
    initializeTheme() {
        // Check for saved theme preference or default to light mode
        const savedTheme = localStorage.getItem('zaura-health-theme') || 'light';
        this.setTheme(savedTheme);
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('zaura-health-theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        
        // Save preference
        localStorage.setItem('zaura-health-theme', newTheme);
    }

    /**
     * Set the theme
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle icon
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        // Update theme toggle title
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.title = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
        }
    }

    /**
     * Animate element
     */
    animateElement(element, animationClass, callback = null) {
        element.classList.add(animationClass);
        
        const handleAnimationEnd = () => {
            element.classList.remove(animationClass);
            element.removeEventListener('animationend', handleAnimationEnd);
            if (callback) callback();
        };
        
        element.addEventListener('animationend', handleAnimationEnd);
    }
}

// Global utility functions
window.hideError = function() {
    if (window.zauraHealthApp) {
        window.zauraHealthApp.hideError();
    }
};

window.closeModal = function(modalId) {
    if (window.zauraHealthApp) {
        window.zauraHealthApp.closeModal(modalId);
    }
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.zauraHealthApp = new ZauraHealthApp();
    
    // Add CSS animations and styles
    const style = document.createElement('style');
    style.textContent = `
        /* Animation keyframes */
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes slideOutUp {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-20px);
            }
        }
        
        .slideInUp {
            animation: slideInUp 0.3s ease-out;
        }
        
        .slideOutUp {
            animation: slideOutUp 0.3s ease-out;
        }
        
        /* Validation styles */
        .form-input.valid {
            border-color: #22c55e;
            background-color: rgba(34, 197, 94, 0.05);
        }
        
        .form-input.invalid {
            border-color: #ef4444;
            background-color: rgba(239, 68, 68, 0.05);
        }
        
        /* Suggestions dropdown */
        .suggestions-dropdown {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .suggestion-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .suggestion-item:hover {
            background-color: #f3f4f6;
        }
        
        .suggestion-item:last-child {
            border-bottom: none;
        }
        
        /* Error alert */
        .error-alert {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            max-width: 400px;
        }
        
        .error-content {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #dc2626;
        }
        
        .error-close {
            background: none;
            border: none;
            cursor: pointer;
            color: #dc2626;
            padding: 4px;
            margin-left: auto;
        }
        
        .error-close:hover {
            color: #b91c1c;
        }
        
        /* Result cards */
        .combination-card {
            background: white;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            border-left: 4px solid;
        }
        
        .combination-card.safe {
            border-left-color: #22c55e;
            background-color: #f0fdf4;
        }
        
        .combination-card.unsafe {
            border-left-color: #ef4444;
            background-color: #fef2f2;
        }
        
        .combination-card.error {
            border-left-color: #f59e0b;
            background-color: #fffbeb;
        }
        
        .combination-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .combination-name {
            font-weight: 600;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .status-badge.safe {
            background: #22c55e;
            color: white;
        }
        
        .status-badge.unsafe {
            background: #ef4444;
            color: white;
        }
        
        .status-badge.error {
            background: #f59e0b;
            color: white;
        }
        
        .confidence-bar {
            background: #f3f4f6;
            height: 8px;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
            margin-top: 4px;
        }
        
        .confidence-fill {
            background: #3b82f6;
            height: 100%;
            transition: width 0.5s ease;
        }
        
        /* Recommendation cards */
        .recommendation-card {
            display: flex;
            gap: 12px;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 12px;
        }
        
        .recommendation-card.warning {
            background: #fef2f2;
            border: 1px solid #fecaca;
        }
        
        .recommendation-card.caution {
            background: #fffbeb;
            border: 1px solid #fed7aa;
        }
        
        .recommendation-card.info {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
        }
        
        .recommendation-icon {
            flex-shrink: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .recommendation-content h4 {
            margin: 0 0 4px 0;
            font-weight: 600;
        }
        
        .recommendation-content p {
            margin: 0;
            font-size: 14px;
            line-height: 1.4;
        }
        
        /* Dosage items */
        .dosage-item {
            background: white;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            border-left: 4px solid;
        }
        
        .dosage-item.safe {
            border-left-color: #22c55e;
            background-color: #f0fdf4;
        }
        
        .dosage-item.warning {
            border-left-color: #f59e0b;
            background-color: #fffbeb;
        }
        
        .dosage-item.danger {
            border-left-color: #ef4444;
            background-color: #fef2f2;
        }
        
        .drug-name {
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .dosage-amount {
            font-size: 14px;
            color: #6b7280;
        }
        
        .safety-level {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin: 4px 0;
        }
        
        .safety-message {
            font-size: 12px;
            color: #6b7280;
        }
    `;
    document.head.appendChild(style);
});

console.log('🚀 Z Corp.® Enhanced JavaScript loaded successfully');