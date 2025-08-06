// Pricing Config Stub
// Minimal implementation to prevent errors after removing financial features

window.pricingConfig = {
    formatCurrency: function(value) {
        return `${value} CHF`;
    },
    
    calculateSequenceFinancials: function(sequence) {
        return {
            summary: {
                totalRevenue: 0,
                totalCosts: 0,
                totalProfit: 0,
                averageMargin: 0
            },
            breakdown: [],
            costBreakdown: {
                labor: 0,
                materials: 0,
                lab: 0,
                overhead: 0
            }
        };
    },
    
    current: function() {
        return {
            currency: 'CHF',
            procedures: {}
        };
    },
    
    getAllProcedures: function() {
        return [];
    },
    
    getProcedure: function(key) {
        return null;
    },
    
    addOrUpdateProcedure: function(name, data) {
        // Stub
    },
    
    deleteProcedure: function(key) {
        // Stub
    },
    
    update: function(config) {
        // Stub
    },
    
    export: function() {
        // Stub
    },
    
    import: async function(file) {
        // Stub
    }
};