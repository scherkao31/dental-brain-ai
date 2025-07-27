// Swiss Dental Pricing Configuration
// Based on TARMED and typical Swiss dental practice rates

const defaultPricingConfig = {
    // Currency
    currency: 'CHF',
    
    // Hourly rates (Swiss dentist average)
    hourlyRates: {
        dentist: 450,        // CHF per hour for dentist
        hygienist: 120,      // CHF per hour for hygienist
        assistant: 80        // CHF per hour for assistant
    },
    
    // Fixed costs per session
    sessionCosts: {
        materials: 50,       // Average material cost per session
        sterilization: 20,   // Sterilization costs
        overhead: 30         // General overhead per session
    },
    
    // Common procedures with base prices (TARMED-inspired)
    procedures: {
        // Diagnostics
        'consultation': { 
            basePrice: 150, 
            duration: 30, 
            category: 'diagnostic',
            materials: 10
        },
        'radiographie': { 
            basePrice: 80, 
            duration: 15, 
            category: 'diagnostic',
            materials: 20
        },
        'radiographie panoramique': { 
            basePrice: 180, 
            duration: 20, 
            category: 'diagnostic',
            materials: 30
        },
        
        // Preventive
        'détartrage': { 
            basePrice: 180, 
            duration: 45, 
            category: 'preventive',
            materials: 20,
            performer: 'hygienist'
        },
        'prophylaxie': { 
            basePrice: 150, 
            duration: 30, 
            category: 'preventive',
            materials: 25,
            performer: 'hygienist'
        },
        
        // Restorative
        'composite': { 
            basePrice: 250, 
            duration: 45, 
            category: 'restorative',
            materials: 80
        },
        'composite complexe': { 
            basePrice: 350, 
            duration: 60, 
            category: 'restorative',
            materials: 120
        },
        
        // Endodontics
        'traitement de racine': { 
            basePrice: 800, 
            duration: 90, 
            category: 'endodontic',
            materials: 150
        },
        'traitement de racine 3 canaux': { 
            basePrice: 1200, 
            duration: 120, 
            category: 'endodontic',
            materials: 200
        },
        'traitement de racine 4 canaux': { 
            basePrice: 1500, 
            duration: 150, 
            category: 'endodontic',
            materials: 250
        },
        
        // Prosthetics
        'couronne céramique': { 
            basePrice: 1800, 
            duration: 60, 
            category: 'prosthetic',
            materials: 600,
            labCost: 800
        },
        'couronne provisoire': { 
            basePrice: 350, 
            duration: 45, 
            category: 'prosthetic',
            materials: 80
        },
        'facette': { 
            basePrice: 1500, 
            duration: 90, 
            category: 'prosthetic',
            materials: 400,
            labCost: 600
        },
        'inlay/onlay': { 
            basePrice: 1200, 
            duration: 75, 
            category: 'prosthetic',
            materials: 350,
            labCost: 400
        },
        
        // Surgical
        'extraction simple': { 
            basePrice: 350, 
            duration: 30, 
            category: 'surgical',
            materials: 50
        },
        'extraction complexe': { 
            basePrice: 600, 
            duration: 60, 
            category: 'surgical',
            materials: 100
        },
        
        // Implants
        'implant': { 
            basePrice: 2500, 
            duration: 90, 
            category: 'implant',
            materials: 1200
        },
        'pilier implantaire': { 
            basePrice: 800, 
            duration: 30, 
            category: 'implant',
            materials: 400
        },
        
        // Special procedures
        'anesthésie': { 
            basePrice: 50, 
            duration: 10, 
            category: 'auxiliary',
            materials: 20
        },
        'empreinte': { 
            basePrice: 150, 
            duration: 30, 
            category: 'auxiliary',
            materials: 60
        },
        'moignon adhésif': { 
            basePrice: 400, 
            duration: 45, 
            category: 'restorative',
            materials: 150
        },
        'dépose couronne': { 
            basePrice: 250, 
            duration: 30, 
            category: 'auxiliary',
            materials: 20
        }
    },
    
    // Profit margins by category
    profitMargins: {
        diagnostic: 0.70,    // 70% profit margin
        preventive: 0.65,    // 65% profit margin
        restorative: 0.60,   // 60% profit margin
        endodontic: 0.55,    // 55% profit margin
        prosthetic: 0.45,    // 45% profit margin (due to lab costs)
        surgical: 0.65,      // 65% profit margin
        implant: 0.40,       // 40% profit margin (high material costs)
        auxiliary: 0.80      // 80% profit margin
    }
};

// Function to calculate procedure cost
function calculateProcedureCost(procedureName, quantity = 1, customPrice = null) {
    const procedure = defaultPricingConfig.procedures[procedureName.toLowerCase()];
    
    if (!procedure && !customPrice) {
        // If procedure not found, estimate based on keywords
        return estimateProcedureCost(procedureName);
    }
    
    if (customPrice) {
        return {
            revenue: customPrice * quantity,
            costs: customPrice * 0.4 * quantity, // Assume 40% cost
            profit: customPrice * 0.6 * quantity,
            margin: 0.6
        };
    }
    
    // Calculate costs
    const performer = procedure.performer || 'dentist';
    const hourlyRate = defaultPricingConfig.hourlyRates[performer];
    const laborCost = (procedure.duration / 60) * hourlyRate;
    const materialCost = procedure.materials || 0;
    const labCost = procedure.labCost || 0;
    const overheadCost = defaultPricingConfig.sessionCosts.overhead;
    
    const totalCost = (laborCost + materialCost + labCost + overheadCost) * quantity;
    const revenue = (procedure.basePrice || 0) * quantity;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? profit / revenue : 0;
    
    return {
        revenue,
        costs: totalCost,
        laborCost: laborCost * quantity,
        materialCost: materialCost * quantity,
        labCost: labCost * quantity,
        overheadCost: overheadCost * quantity,
        profit,
        margin,
        quantity,
        unitPrice: procedure.basePrice,
        duration: procedure.duration * quantity
    };
}

// Estimate cost for unknown procedures
function estimateProcedureCost(procedureName) {
    const name = procedureName.toLowerCase();
    
    // Default estimates based on keywords
    if (name.includes('couronne') || name.includes('cc')) {
        return calculateProcedureCost('couronne céramique');
    } else if (name.includes('facette') || name.includes('fac')) {
        return calculateProcedureCost('facette');
    } else if (name.includes('composite') || name.includes('cpr')) {
        return calculateProcedureCost('composite');
    } else if (name.includes('racine') || name.includes('tr')) {
        return calculateProcedureCost('traitement de racine');
    } else if (name.includes('implant')) {
        return calculateProcedureCost('implant');
    } else if (name.includes('extraction') || name.includes('ext')) {
        return calculateProcedureCost('extraction simple');
    } else if (name.includes('détartrage')) {
        return calculateProcedureCost('détartrage');
    } else if (name.includes('empreinte')) {
        return calculateProcedureCost('empreinte');
    } else if (name.includes('anesthésie')) {
        return calculateProcedureCost('anesthésie');
    } else if (name.includes('moignon') || name.includes('ma')) {
        return calculateProcedureCost('moignon adhésif');
    }
    
    // Generic estimate
    return {
        revenue: 300,
        costs: 120,
        profit: 180,
        margin: 0.6,
        estimated: true
    };
}

// Calculate full treatment sequence financials
function calculateSequenceFinancials(treatmentSequence) {
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalDuration = 0;
    let procedureBreakdown = [];
    
    treatmentSequence.forEach((appointment, index) => {
        const procedures = parseProceduresFromAppointment(appointment);
        let appointmentRevenue = 0;
        let appointmentCosts = 0;
        let appointmentDuration = 0;
        
        procedures.forEach(proc => {
            const financial = calculateProcedureCost(proc.name, proc.quantity);
            appointmentRevenue += financial.revenue;
            appointmentCosts += financial.costs;
            appointmentDuration += financial.duration || 0;
            
            procedureBreakdown.push({
                appointment: index + 1,
                procedure: proc.name,
                quantity: proc.quantity,
                ...financial
            });
        });
        
        totalRevenue += appointmentRevenue;
        totalCosts += appointmentCosts;
        totalDuration += appointmentDuration;
    });
    
    const totalProfit = totalRevenue - totalCosts;
    const overallMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
    
    // Calculate monthly equivalent (assuming treatment over 6 months)
    const treatmentMonths = estimateTreatmentDuration(treatmentSequence);
    const monthlyRevenue = totalRevenue / treatmentMonths;
    
    return {
        summary: {
            totalRevenue,
            totalCosts,
            totalProfit,
            overallMargin,
            totalDuration,
            appointmentCount: treatmentSequence.length,
            monthlyRevenue,
            treatmentMonths
        },
        breakdown: procedureBreakdown,
        costBreakdown: {
            labor: procedureBreakdown.reduce((sum, p) => sum + (p.laborCost || 0), 0),
            materials: procedureBreakdown.reduce((sum, p) => sum + (p.materialCost || 0), 0),
            lab: procedureBreakdown.reduce((sum, p) => sum + (p.labCost || 0), 0),
            overhead: procedureBreakdown.reduce((sum, p) => sum + (p.overheadCost || 0), 0)
        }
    };
}

// Parse procedures from appointment description
function parseProceduresFromAppointment(appointment) {
    const treatment = appointment.traitement || '';
    const procedures = [];
    
    // Look for quantity patterns (e.g., "4 facettes", "2 couronnes")
    const quantityPattern = /(\d+)\s*(?:x\s*)?([a-zA-Zéèêëàâäôöûü\s]+)/gi;
    const matches = treatment.matchAll(quantityPattern);
    
    for (const match of matches) {
        const quantity = parseInt(match[1]);
        const procedureName = match[2].trim();
        procedures.push({ name: procedureName, quantity });
    }
    
    // If no quantity found, assume single procedure
    if (procedures.length === 0) {
        // Split by common separators
        const parts = treatment.split(/[,+&]/);
        parts.forEach(part => {
            const cleaned = part.trim();
            if (cleaned) {
                procedures.push({ name: cleaned, quantity: 1 });
            }
        });
    }
    
    return procedures.length > 0 ? procedures : [{ name: treatment, quantity: 1 }];
}

// Estimate treatment duration in months
function estimateTreatmentDuration(sequence) {
    let totalDays = 0;
    
    sequence.forEach((appointment, index) => {
        if (appointment.delai && index < sequence.length - 1) {
            // Parse delay strings like "1 sem", "2 mois", "10 jours"
            const delayMatch = appointment.delai.match(/(\d+)\s*(\w+)/);
            if (delayMatch) {
                const value = parseInt(delayMatch[1]);
                const unit = delayMatch[2].toLowerCase();
                
                if (unit.includes('jour')) {
                    totalDays += value;
                } else if (unit.includes('sem')) {
                    totalDays += value * 7;
                } else if (unit.includes('mois')) {
                    totalDays += value * 30;
                }
            }
        }
    });
    
    // Add some buffer time
    totalDays += 30;
    
    return Math.max(1, Math.ceil(totalDays / 30));
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-CH', {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Load pricing configuration from localStorage
function loadPricingConfig() {
    const saved = localStorage.getItem('dentalPricingConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            // Merge with default to ensure all properties exist
            return { ...defaultPricingConfig, ...config };
        } catch (e) {
            console.error('Error loading pricing config:', e);
        }
    }
    return defaultPricingConfig;
}

// Save pricing configuration to localStorage
function savePricingConfigToStorage(config) {
    try {
        localStorage.setItem('dentalPricingConfig', JSON.stringify(config));
        return true;
    } catch (e) {
        console.error('Error saving pricing config:', e);
        return false;
    }
}

// Get current pricing configuration
let currentPricingConfig = loadPricingConfig();

// Update pricing configuration
function updatePricingConfig(updates) {
    currentPricingConfig = { ...currentPricingConfig, ...updates };
    savePricingConfigToStorage(currentPricingConfig);
}

// Export pricing configuration
function exportPricingConfig() {
    const config = currentPricingConfig;
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `dental-pricing-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Import pricing configuration
function importPricingConfig(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                // Validate the imported config has required fields
                if (config.currency && config.hourlyRates && config.procedures) {
                    currentPricingConfig = config;
                    savePricingConfigToStorage(config);
                    resolve(config);
                } else {
                    reject(new Error('Invalid pricing configuration file'));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsText(file);
    });
}

// Get procedure by name
function getProcedure(name) {
    const procedures = currentPricingConfig.procedures;
    const key = name.toLowerCase();
    return procedures[key] || null;
}

// Add or update procedure
function addOrUpdateProcedure(name, procedureData) {
    const key = name.toLowerCase();
    currentPricingConfig.procedures[key] = procedureData;
    savePricingConfigToStorage(currentPricingConfig);
}

// Delete procedure
function deleteProcedure(name) {
    const key = name.toLowerCase();
    delete currentPricingConfig.procedures[key];
    savePricingConfigToStorage(currentPricingConfig);
}

// Get all procedures sorted by category
function getAllProceduresSorted() {
    const procedures = currentPricingConfig.procedures;
    const sorted = [];
    
    for (const [key, data] of Object.entries(procedures)) {
        sorted.push({
            key,
            name: key.charAt(0).toUpperCase() + key.slice(1),
            ...data
        });
    }
    
    return sorted.sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });
}

// Export functions
window.pricingConfig = {
    default: defaultPricingConfig,
    current: () => currentPricingConfig,
    calculateProcedureCost: (name, quantity, customPrice) => 
        calculateProcedureCost(name, quantity, customPrice),
    calculateSequenceFinancials,
    formatCurrency,
    load: loadPricingConfig,
    save: savePricingConfigToStorage,
    update: updatePricingConfig,
    export: exportPricingConfig,
    import: importPricingConfig,
    getProcedure,
    addOrUpdateProcedure,
    deleteProcedure,
    getAllProcedures: getAllProceduresSorted
};