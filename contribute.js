// Contribution page functionality
class ContributionManager {
    constructor() {
        this.drugCount = 2; // Start with 2 drugs
        this.maxDrugs = 10;
        
        this.initializeEventListeners();
        this.initializeThemeToggle();
    }
    
    initializeEventListeners() {
        // Add drug button
        document.getElementById('addContribDrugBtn').addEventListener('click', () => {
            this.addDrugInput();
        });
        
        // Form submission
        document.getElementById('contributionForm').addEventListener('submit', (e) => {
            this.handleFormSubmission(e);
        });
        
        // Modal actions
        document.getElementById('addAnotherBtn').addEventListener('click', () => {
            this.resetForm();
            this.closeModal();
        });
        
        document.getElementById('viewAnalysisBtn').addEventListener('click', () => {
            window.location.href = '/';
        });
        
        // Drug input validation
        this.setupDrugValidation();
        
        // Safety option selection
        this.setupSafetyOptions();
    }
    
    addDrugInput() {
        if (this.drugCount >= this.maxDrugs) {
            this.showAlert('Maximum 10 drugs allowed per combination', 'warning');
            return;
        }
        
        this.drugCount++;
        const drugsGrid = document.getElementById('contributionDrugsGrid');
        
        const drugInputGroup = document.createElement('div');
        drugInputGroup.className = 'drug-input-group';
        drugInputGroup.innerHTML = `
            <label for="contrib_drug${this.drugCount}">Drug ${this.drugCount}</label>
            <div class="input-with-remove">
                <input type="text" id="contrib_drug${this.drugCount}" name="drugs[]" 
                       placeholder="Enter drug name...">
                <button type="button" class="remove-drug-btn" onclick="contributionManager.removeDrugInput(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        drugsGrid.appendChild(drugInputGroup);
        
        // Focus on new input
        document.getElementById(`contrib_drug${this.drugCount}`).focus();
        
        // Add validation to new input
        this.setupInputValidation(document.getElementById(`contrib_drug${this.drugCount}`));
    }
    
    removeDrugInput(button) {
        if (this.drugCount <= 2) {
            this.showAlert('At least 2 drugs are required', 'warning');
            return;
        }
        
        const drugGroup = button.closest('.drug-input-group');
        drugGroup.remove();
        this.drugCount--;
        
        // Update labels
        this.updateDrugLabels();
    }
    
    updateDrugLabels() {
        const drugGroups = document.querySelectorAll('#contributionDrugsGrid .drug-input-group');
        drugGroups.forEach((group, index) => {
            const label = group.querySelector('label');
            const input = group.querySelector('input');
            const drugNumber = index + 1;
            
            label.textContent = `Drug ${drugNumber}${drugNumber <= 2 ? ' *' : ''}`;
            input.id = `contrib_drug${drugNumber}`;
            label.setAttribute('for', input.id);
            
            if (drugNumber <= 2) {
                input.required = true;
            } else {
                input.required = false;
            }
        });
    }
    
    setupDrugValidation() {
        const drugInputs = document.querySelectorAll('input[name="drugs[]"]');
        drugInputs.forEach(input => {
            this.setupInputValidation(input);
        });
    }
    
    setupInputValidation(input) {
        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            
            // Basic validation
            if (value.length > 0) {
                // Check for valid drug name format
                if (/^[a-zA-Z0-9\s\-\.]+$/.test(value)) {
                    e.target.classList.remove('error');
                    e.target.classList.add('valid');
                } else {
                    e.target.classList.add('error');
                    e.target.classList.remove('valid');
                }
            } else {
                e.target.classList.remove('error', 'valid');
            }
        });
    }
    
    setupSafetyOptions() {
        const safetyOptions = document.querySelectorAll('input[name="safety_label"]');
        safetyOptions.forEach(option => {
            option.addEventListener('change', (e) => {
                // Visual feedback for selection
                document.querySelectorAll('.radio-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                if (e.target.checked) {
                    e.target.closest('.radio-option').classList.add('selected');
                }
            });
        });
    }
    
    async handleFormSubmission(e) {
        e.preventDefault();
        
        const formData = this.collectFormData();
        if (!this.validateFormData(formData)) {
            return;
        }
        
        // Show loading state
        const submitBtn = document.querySelector('.btn-primary[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Contributing...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/contribute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccessModal(formData);
            } else {
                this.showAlert(result.error || 'Failed to submit contribution', 'error');
            }
        } catch (error) {
            console.error('Contribution error:', error);
            this.showAlert('Network error. Please try again.', 'error');
        } finally {
            // Restore button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    
    collectFormData() {
        const drugs = [];
        const drugInputs = document.querySelectorAll('input[name="drugs[]"]');
        drugInputs.forEach(input => {
            if (input.value.trim()) {
                drugs.push(input.value.trim());
            }
        });
        
        const safetyLabel = document.querySelector('input[name="safety_label"]:checked')?.value;
        const dosageInfo = document.getElementById('dosage_info').value.trim();
        const confidenceLevel = document.getElementById('confidence_level').value;
        const notes = document.getElementById('notes').value.trim();
        
        return {
            drugs,
            safety_label: safetyLabel,
            dosage_info: dosageInfo,
            confidence_level: parseInt(confidenceLevel),
            notes
        };
    }
    
    validateFormData(formData) {
        // Check minimum drugs
        if (formData.drugs.length < 2) {
            this.showAlert('At least 2 drugs are required', 'error');
            return false;
        }
        
        // Check for duplicate drugs
        const uniqueDrugs = new Set(formData.drugs.map(d => d.toLowerCase()));
        if (uniqueDrugs.size !== formData.drugs.length) {
            this.showAlert('Duplicate drugs are not allowed', 'error');
            return false;
        }
        
        // Check safety label
        if (!formData.safety_label) {
            this.showAlert('Please select a safety assessment', 'error');
            return false;
        }
        
        // Validate drug names
        for (const drug of formData.drugs) {
            if (!/^[a-zA-Z0-9\s\-\.]+$/.test(drug)) {
                this.showAlert(`Invalid drug name format: ${drug}`, 'error');
                return false;
            }
        }
        
        return true;
    }
    
    showSuccessModal(formData) {
        const modal = document.getElementById('successModal');
        const summary = document.getElementById('contributionSummary');
        
        const safetyClass = formData.safety_label === 'safe' ? 'success' : 'danger';
        const safetyIcon = formData.safety_label === 'safe' ? 'check-circle' : 'exclamation-triangle';
        
        summary.innerHTML = `
            <div class="summary-item">
                <strong>Drugs:</strong> ${formData.drugs.join(', ')}
            </div>
            <div class="summary-item">
                <strong>Safety:</strong> 
                <span class="badge badge-${safetyClass}">
                    <i class="fas fa-${safetyIcon}"></i> ${formData.safety_label.toUpperCase()}
                </span>
            </div>
            ${formData.dosage_info ? `
                <div class="summary-item">
                    <strong>Dosage:</strong> ${formData.dosage_info}
                </div>
            ` : ''}
            <div class="summary-item">
                <strong>Confidence:</strong> ${formData.confidence_level}/5
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Add success effect
        setTimeout(() => {
            modal.querySelector('.modal-content').style.transform = 'scale(1)';
        }, 10);
    }
    
    closeModal() {
        const modal = document.getElementById('successModal');
        modal.style.display = 'none';
    }
    
    resetForm() {
        document.getElementById('contributionForm').reset();
        
        // Reset drug count to 2
        const drugsGrid = document.getElementById('contributionDrugsGrid');
        const extraDrugs = drugsGrid.querySelectorAll('.drug-input-group:nth-child(n+3)');
        extraDrugs.forEach(drug => drug.remove());
        this.drugCount = 2;
        
        // Reset validation classes
        document.querySelectorAll('.error, .valid').forEach(el => {
            el.classList.remove('error', 'valid');
        });
        
        // Reset radio options
        document.querySelectorAll('.radio-option').forEach(opt => {
            opt.classList.remove('selected');
        });
    }
    
    showAlert(message, type) {
        const alertContainer = document.getElementById('alertContainer');
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        alert.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
            <button class="alert-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
        
        // Animate in
        setTimeout(() => {
            alert.style.transform = 'translateX(0)';
            alert.style.opacity = '1';
        }, 10);
    }
    
    initializeThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const body = document.body;
        
        // Check for saved theme
        const savedTheme = localStorage.getItem('zaura-theme') || 'light';
        body.setAttribute('data-theme', savedTheme);
        
        // Update toggle icon
        this.updateThemeIcon(savedTheme);
        
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('zaura-theme', newTheme);
            
            this.updateThemeIcon(newTheme);
        });
    }
    
    updateThemeIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.contributionManager = new ContributionManager();
});

// Modal click outside to close
window.addEventListener('click', (e) => {
    const modal = document.getElementById('successModal');
    if (e.target === modal) {
        contributionManager.closeModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape') {
        contributionManager.closeModal();
    }
    
    // Ctrl+Enter to submit form (if focused on form)
    if (e.ctrlKey && e.key === 'Enter') {
        const form = document.getElementById('contributionForm');
        if (form.contains(document.activeElement)) {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }
});

// Auto-resize textarea
document.getElementById('notes').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

// Drug name suggestions (placeholder for future enhancement)
function setupDrugSuggestions() {
    const drugInputs = document.querySelectorAll('input[name="drugs[]"]');
    
    drugInputs.forEach(input => {
        input.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                // Placeholder for drug name suggestions API
                // Could integrate with drug database for auto-completion
            }
        });
    });
}

// Initialize drug suggestions
document.addEventListener('DOMContentLoaded', setupDrugSuggestions);