/**
 * Zaura Health - Interactive JavaScript Application
 * Professional drug interaction analysis interface by Z Corp.®
 */

class ZauraHealthApp {
    constructor() {
        this.drugInputs = [];
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
        this.addInitialDrugInputs();
        this.setupKeyboardShortcuts();
        this.initializeTheme();
        
        // Check API health on load
        this.checkAPIHealth();
        
        console.log('� Z Corp.® Application initialized');
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

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Modal buttons
        const aboutBtn = document.getElementById('aboutBtn');
        const helpBtn = document.getElementById('helpBtn');
        
        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => this.openModal('aboutModal'));
        }
        
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openModal('helpModal'));
        }

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
     * Add initial drug inputs
     */
    addInitialDrugInputs() {
        // Add two initial inputs
        for (let i = 0; i < this.minDrugs; i++) {
            this.addDrugInput();
        }
    }

    /**
     * Add a new drug input field
     */
    addDrugInput() {
        if (this.drugInputs.length >= this.maxDrugs) {
            this.showError(`Maximum ${this.maxDrugs} drugs supported per analysis`);
            return;
        }

        const container = document.getElementById('drugInputs');
        if (!container) return;

        const inputId = `drug${Date.now()}`;
        const canRemove = this.drugInputs.length >= this.minDrugs;

        const inputGroup = document.createElement('div');
        inputGroup.className = 'drug-input-group';
        inputGroup.setAttribute('data-input-id', inputId);

        inputGroup.innerHTML = `
            <input type="text" 
                   id="${inputId}" 
                   name="drug" 
                   class="form-input drug-input"
                   placeholder="Enter drug name (e.g., Aspirin, Metformin)"
                   required
                   autocomplete="off"
                   data-drug-input>
            ${canRemove ? `
                <button type="button" 
                        class="remove-drug-btn" 
                        onclick="zauraHealthApp.removeDrugInput('${inputId}')"
                        title="Remove this drug">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        `;

        container.appendChild(inputGroup);
        this.drugInputs.push(inputId);

        // Focus on new input
        const newInput = document.getElementById(inputId);
        if (newInput) {
            newInput.focus();
            this.setupDrugInputEvents(newInput);
        }

        this.updateAddButton();
        this.animateElement(inputGroup, 'slideInUp');
    }

    /**
     * Remove a drug input field
     */
    removeDrugInput(inputId) {
        if (this.drugInputs.length <= this.minDrugs) {
            this.showError(`Minimum ${this.minDrugs} drugs required for analysis`);
            return;
        }

        const inputGroup = document.querySelector(`[data-input-id="${inputId}"]`);
        if (inputGroup) {
            this.animateElement(inputGroup, 'slideOutUp', () => {
                inputGroup.remove();
            });
        }

        this.drugInputs = this.drugInputs.filter(id => id !== inputId);
        this.updateAddButton();
    }

    /**
     * Setup events for drug input fields
     */
    setupDrugInputEvents(input) {
        // Real-time validation
        input.addEventListener('input', () => {
            this.validateDrugInput(input);
        });

        // Enter key to add new drug
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                this.addDrugInput();
            }
        });

        // Drug name suggestions (basic implementation)
        input.addEventListener('focus', () => {
            this.showDrugSuggestions(input);
        });

        input.addEventListener('blur', () => {
            // Hide suggestions after a delay
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
     * Show drug suggestions (placeholder implementation)
     */
    showDrugSuggestions(input) {
        // This would typically fetch from the API
        // For now, just showing common drugs
        const commonDrugs = [
            'Aspirin', 'Ibuprofen', 'Acetaminophen', 'Metformin', 'Lisinopril',
            'Atorvastatin', 'Warfarin', 'Insulin', 'Omeprazole', 'Amlodipine'
        ];
        
        // Implementation would add a dropdown here
        console.log('Showing suggestions for:', input.value);
    }

    /**
     * Hide drug suggestions
     */
    hideDrugSuggestions(input) {
        // Remove suggestion dropdown
        console.log('Hiding suggestions');
    }

    /**
     * Update add drug button state
     */
    updateAddButton() {
        const addBtn = document.getElementById('addDrugBtn');
        if (!addBtn) return;

        if (this.drugInputs.length >= this.maxDrugs) {
            addBtn.disabled = true;
            addBtn.innerHTML = '<i class="fas fa-ban"></i> Maximum Drugs Reached';
        } else {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Another Drug';
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
        const drugInputs = document.querySelectorAll('[data-drug-input]');
        const dosageInput = document.getElementById('dosageInput');

        // Collect drug names
        const drugs = [];
        const invalidInputs = [];

        drugInputs.forEach(input => {
            const value = input.value.trim();
            if (value) {
                if (value.length < 2) {
                    invalidInputs.push(input);
                    return;
                }
                drugs.push(value);
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

        // Collect dosage
        const dosage = dosageInput.value ? parseFloat(dosageInput.value) : null;
        if (dosage !== null && (dosage < 0 || dosage > 100)) {
            this.showError('Please enter a valid dosage (0-100 doses per 24 hours)');
            dosageInput.focus();
            return null;
        }

        return {
            drugs: uniqueDrugs,
            dosage: dosage
        };
    }

    /**
     * Set analyzing state
     */
    setAnalyzingState(analyzing) {
        this.isAnalyzing = analyzing;
        const analyzeBtn = document.getElementById('analyzeBtn');
        
        if (analyzeBtn) {
            analyzeBtn.disabled = analyzing;
            
            if (analyzing) {
                analyzeBtn.classList.add('loading');
            } else {
                analyzeBtn.classList.remove('loading');
            }
        }
    }

    /**
     * Display analysis results
     */
    displayResults(data) {
        const resultsSection = document.getElementById('resultsSection');
        if (!resultsSection) return;

        // Update results title and meta
        this.updateResultsHeader(data);
        
        // Display overall safety
        this.displayOverallSafety(data);
        
        // Display safety score
        this.displaySafetyScore(data);
        
        // Display detailed results
        this.displayDetailedResults(data);
        
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
     * Update results header
     */
    updateResultsHeader(data) {
        const title = document.getElementById('resultsTitle');
        const meta = document.getElementById('resultsMeta');
        
        if (title) {
            title.innerHTML = `
                <i class="fas fa-chart-line"></i>
                Analysis Complete
            `;
        }
        
        if (meta) {
            meta.innerHTML = `
                Analyzed ${data.input_drugs.length} drugs • 
                ${data.total_combinations} combinations tested • 
                ${data.dosage_info}
            `;
        }
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
     * Display safety score
     */
    displaySafetyScore(data) {
        const container = document.getElementById('safetyScoreSection');
        if (!container) return;

        const scorePercentage = Math.round(data.safety_score * 100);
        
        container.innerHTML = `
            <h3>
                <i class="fas fa-tachometer-alt"></i>
                Safety Score
            </h3>
            <div class="safety-score-bar">
                <div class="safety-score-fill" style="width: ${scorePercentage}%"></div>
            </div>
            <div class="safety-score-text">
                ${scorePercentage}% of combinations are safe
                (${data.safe_combinations} safe, ${data.unsafe_combinations} unsafe)
            </div>
        `;
    }

    /**
     * Display detailed results
     */
    displayDetailedResults(data) {
        const container = document.getElementById('detailedResults');
        if (!container) return;

        let html = `
            <h3>
                <i class="fas fa-list-ul"></i>
                Detailed Combination Analysis
            </h3>
        `;

        // Sort combinations by safety (unsafe first, then by confidence)
        const combinations = Object.entries(data.detailed_results).sort(([, a], [, b]) => {
            if (a.prediction !== b.prediction) {
                return a.prediction === 'unsafe' ? -1 : 1;
            }
            return b.confidence - a.confidence;
        });

        combinations.forEach(([combination, result]) => {
            if (result.error) {
                html += `
                    <div class="combination-result error">
                        <div class="combination-drugs">${combination}</div>
                        <div class="combination-status">
                            <i class="fas fa-exclamation-circle status-icon error"></i>
                            <span>Error: ${result.error}</span>
                        </div>
                    </div>
                `;
                return;
            }

            const isSafe = result.prediction === 'safe';
            const statusClass = isSafe ? 'safe' : 'unsafe';
            const icon = isSafe ? 'fa-check-circle' : 'fa-exclamation-triangle';
            const confidencePercentage = Math.round(result.confidence * 100);

            html += `
                <div class="combination-result ${statusClass}">
                    <div class="combination-drugs">
                        ${combination}
                        <small>(${result.drug_count} drugs)</small>
                    </div>
                    <div class="combination-status">
                        <i class="fas ${icon} status-icon ${statusClass}"></i>
                        <div>
                            <div>${result.prediction.toUpperCase()}</div>
                            <div class="confidence-score">
                                Confidence: ${confidencePercentage}%
                            </div>
                        </div>
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
        const container = document.getElementById('recommendations');
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

        if (data.dosage_info === 'No dosage specified') {
            recommendations.push({
                type: 'info',
                icon: 'fa-clock',
                title: 'Include Dosage Information',
                text: 'For more accurate analysis, include dosage information (doses per 24 hours) when available.'
            });
        }

        recommendations.push({
            type: 'general',
            icon: 'fa-user-md',
            title: 'Professional Medical Advice',
            text: 'This AI analysis is for informational purposes only. Always consult qualified healthcare professionals for medical decisions.'
        });

        let html = `
            <h3>
                <i class="fas fa-lightbulb"></i>
                Recommendations & Guidelines
            </h3>
        `;

        recommendations.forEach(rec => {
            html += `
                <div class="recommendation-item ${rec.type}">
                    <i class="fas ${rec.icon}"></i>
                    <div>
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
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => this.hideError(), 5000);
        }
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
        
        // Add celebratory animation
        this.celebrateThemeChange();
    }

    /**
     * Set the theme
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle icon
        const themeIcon = document.getElementById('themeIcon');
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
     * Celebrate theme change with animation
     */
    celebrateThemeChange() {
        // Create sparkle effect
        const sparkles = [];
        const colors = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b'];
        
        for (let i = 0; i < 12; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.position = 'fixed';
            sparkle.style.pointerEvents = 'none';
            sparkle.style.zIndex = '9999';
            sparkle.style.width = '4px';
            sparkle.style.height = '4px';
            sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
            sparkle.style.borderRadius = '50%';
            sparkle.style.left = '50%';
            sparkle.style.top = '20%';
            
            document.body.appendChild(sparkle);
            sparkles.push(sparkle);
            
            // Animate sparkle
            const angle = (i / 12) * 360;
            const distance = 100 + Math.random() * 100;
            
            sparkle.animate([
                {
                    transform: 'translate(-50%, -50%) scale(0)',
                    opacity: 1
                },
                {
                    transform: `translate(-50%, -50%) translate(${Math.cos(angle * Math.PI / 180) * distance}px, ${Math.sin(angle * Math.PI / 180) * distance}px) scale(1)`,
                    opacity: 1,
                    offset: 0.7
                },
                {
                    transform: `translate(-50%, -50%) translate(${Math.cos(angle * Math.PI / 180) * distance * 1.5}px, ${Math.sin(angle * Math.PI / 180) * distance * 1.5}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 1000,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }).onfinish = () => {
                document.body.removeChild(sparkle);
            };
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
    
    // Add some CSS animations dynamically
    const style = document.createElement('style');
    style.textContent = `
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
        
        .form-input.valid {
            border-color: var(--success-green);
            background-color: rgba(34, 197, 94, 0.05);
        }
        
        .form-input.invalid {
            border-color: var(--medical-red);
            background-color: rgba(239, 68, 68, 0.05);
        }
        
        .recommendation-item {
            display: flex;
            align-items: flex-start;
            gap: var(--spacing-3);
            padding: var(--spacing-4);
            margin-bottom: var(--spacing-3);
            border-radius: var(--radius-lg);
            border-left: 4px solid;
        }
        
        .recommendation-item.warning {
            background: #fef2f2;
            border-left-color: var(--medical-red);
        }
        
        .recommendation-item.caution {
            background: #fef3c7;
            border-left-color: var(--warning-yellow);
        }
        
        .recommendation-item.info {
            background: #eff6ff;
            border-left-color: var(--accent-blue);
        }
        
        .recommendation-item.general {
            background: var(--gray-50);
            border-left-color: var(--gray-400);
        }
        
        .recommendation-item h4 {
            margin: 0 0 var(--spacing-1) 0;
            font-weight: 600;
            color: var(--gray-800);
        }
        
        .recommendation-item p {
            margin: 0;
            color: var(--text-secondary);
            font-size: var(--font-size-sm);
            line-height: 1.5;
        }
        
        /* ===== Rich Interactive Enhancements ===== */
        .drug-input-group:hover .form-input {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
        
        .analyze-btn {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            position: relative;
            overflow: hidden;
        }
        
        .analyze-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }
        
        .analyze-btn:hover::before {
            left: 100%;
        }
        
        .premium-card {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 2px solid;
            border-image: linear-gradient(135deg, var(--primary-color), var(--secondary-color)) 1;
            position: relative;
            overflow: hidden;
        }
        
        .premium-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--premium-gold), transparent);
            animation: shimmer 2s ease-in-out infinite;
        }
        
        /* ===== Micro-interactions ===== */
        .stat-item {
            cursor: pointer;
            user-select: none;
        }
        
        .stat-item:active {
            transform: translateY(-3px) scale(0.98);
        }
        
        .premium-badge {
            cursor: pointer;
            user-select: none;
        }
        
        .premium-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        }
        
        /* ===== Loading States ===== */
        .loading-pulse {
            animation: pulse 1.5s ease-in-out infinite;
        }
        
        .skeleton {
            background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
        }
    `;
    document.head.appendChild(style);
});

console.log('� Z Corp.® JavaScript loaded successfully');