export const ORGANOID_SIMULATION_CODE = `
// --- THEORIES OF AGING CONFIGURATION ---
// This configuration now defines not just the theories but also which specific Hallmarks of Aging are most relevant to display for each one.
const THEORIES = {
    stochastic: { name: 'Stochastic Damage', description: 'Aging results from accumulating random molecular damage.', stats: ['genomicInstability', 'telomereAttrition', 'proteostasisLoss', 'mitoDysfunction', 'synapticDensity'] },
    hyperfunction: { name: 'Programmed Hyperfunction', description: 'Aging is a harmful continuation of developmental programs.', stats: ['nutrientSensing', 'mitoDysfunction', 'cellularSenescence', 'inflammation', 'networkActivity'] },
    information: { name: 'Information Entropy', description: 'Aging is the loss of epigenetic information and cellular identity.', stats: ['epigeneticAlterations', 'genomicInstability', 'proteostasisLoss', 'stemCellExhaustion', 'synapticDensity'] },
    social: { name: 'Cellular Society Collapse', description: 'Aging is caused by "bad actor" cells disrupting tissue function.', stats: ['cellularSenescence', 'intercellularCommunication', 'inflammation', 'stemCellExhaustion', 'networkActivity'] },
};
const THEORY_KEYS = Object.keys(THEORIES);

// --- ORGANOID STATE & SIMULATION ---
// The state is now explicitly based on the 9 Hallmarks of Aging.
const getInitialOrganoidState = () => ({
    // Foundational
    age: 0,
    lifespan: 1500, // Theoretical max, dynamic based on health decline
    overallHealth: 100,
    // Primary Hallmarks (Causes of Damage)
    genomicInstability: 0,
    telomereAttrition: 0,
    epigeneticAlterations: 0,
    proteostasisLoss: 0,
    // Antagonistic Hallmarks (Responses to Damage)
    nutrientSensing: 0, // Deregulated nutrient sensing
    mitoDysfunction: 0,
    cellularSenescence: 0,
    // Integrative Hallmarks (Culprits of the Phenotype)
    stemCellExhaustion: 0,
    intercellularCommunication: 0, // Altered
    // Functional Outputs
    inflammation: 0,
    synapticDensity: 100,
    networkActivity: 100,
    stemCellFunction: 100, // A functional measure of the stem cell pool
});

const getInitialInterventionEffects = () => ({
    genomicStability: 1.0,      // Multiplier, higher is better (reduces damage rate)
    proteostasis: 1.0,          // Multiplier, higher is better
    mitoEfficiency: 1.0,        // Multiplier, higher is better
    nutrientSensing: 1.0,       // Multiplier, higher is better (inhibits deregulation)
    epigeneticStability: 1.0,   // Multiplier, higher is better
});


const getInitialStates = () => ({
    stochastic: getInitialOrganoidState(),
    hyperfunction: getInitialOrganoidState(),
    information: getInitialOrganoidState(),
    social: getInitialOrganoidState(),
});

// --- CORE AGING LOGIC PER TICK ---
// A single, more complex function that models the interdependencies of the Hallmarks.
const runCoreAgingTick = (prev, effects, weights, theoryKey) => {
    const next = { ...prev };
    let ageFactor = 1 + (next.age / 800); // Gradual acceleration over a longer period

    // --- Theory-Specific Modifications ---
    let inflammationFeedback = 1.0;
    if (theoryKey === 'social' && (next.inflammation > 25 || next.cellularSenescence > 20)) {
        // Tipping Point: Once inflammation/senescence crosses a threshold, it creates a feedback loop that accelerates all other damage.
        inflammationFeedback = 1 + ((next.inflammation - 25) / 75) * 2.0 + ((next.cellularSenescence - 20) / 80) * 1.5;
        ageFactor *= inflammationFeedback;
    }
    
    // 1. Update Primary Hallmarks (Sources of Damage)
    // These now incorporate effects from other hallmarks.
    next.genomicInstability += (0.05 * ageFactor * weights.genomicInstability) / effects.genomicStability;
    next.telomereAttrition += (0.08 * ageFactor * weights.telomereAttrition) * (1 + next.genomicInstability / 200); // GI accelerates telomere loss
    next.epigeneticAlterations += (0.06 * ageFactor * weights.epigeneticAlterations) / effects.epigeneticStability;
    next.proteostasisLoss += ((0.07 * ageFactor * weights.proteostasisLoss) + (next.epigeneticAlterations / 1000)) / effects.proteostasis; // Epigenetic noise causes protein misfolding

    // 2. Update Antagonistic Hallmarks (Responses to Damage)
    next.mitoDysfunction += (((next.genomicInstability + next.proteostasisLoss) / 200) * 0.08 * ageFactor) / effects.mitoEfficiency;
    next.nutrientSensing += (((next.proteostasisLoss + next.mitoDysfunction) / 200) * 0.1 * ageFactor * weights.nutrientSensing) / effects.nutrientSensing;
    next.cellularSenescence += (((next.genomicInstability + next.telomereAttrition) / 200) * 0.12 * ageFactor * weights.cellularSenescence);

    // Clamp primary and antagonistic hallmarks to prevent runaway values
    Object.keys(next).forEach(key => {
      if (['genomicInstability', 'telomereAttrition', 'epigeneticAlterations', 'proteostasisLoss', 'nutrientSensing', 'mitoDysfunction', 'cellularSenescence'].includes(key)) {
        next[key] = Math.max(0, Math.min(100, next[key]));
      }
    });

    // 3. Update Integrative Hallmarks & Functional Outputs (Consequences)
    next.intercellularCommunication = (next.cellularSenescence / 100 * 0.6) + (next.nutrientSensing / 100 * 0.2) + (next.mitoDysfunction / 100 * 0.2);
    next.inflammation = next.intercellularCommunication * 1.2 * weights.inflammation;
    next.stemCellExhaustion += ((next.genomicInstability / 100 * 0.05) + (next.inflammation / 100 * 0.1) + (next.telomereAttrition / 100 * 0.08)) * ageFactor;

    // Functional readouts are consequences of hallmark degradation
    next.stemCellFunction = 100 - next.stemCellExhaustion;
    next.synapticDensity -= ((next.inflammation / 100 * 0.15) + (next.proteostasisLoss / 100 * 0.1) + (next.epigeneticAlterations / 100 * 0.05)) * ageFactor;
    next.networkActivity = next.synapticDensity * (1 - next.mitoDysfunction / 200); // Less severe impact from mito

    // Clamp integrative and functional hallmarks
     Object.keys(next).forEach(key => {
      if (['intercellularCommunication', 'inflammation', 'stemCellExhaustion', 'stemCellFunction', 'synapticDensity', 'networkActivity'].includes(key)) {
        next[key] = Math.max(0, Math.min(100, next[key]));
      }
    });
    
    // 4. Calculate Overall Health (weighted average of functional outputs and key damage hallmarks)
    const healthWeights = {
        // Negative weights (damage)
        genomicInstability: 0.8,
        epigeneticAlterations: 1.0,
        proteostasisLoss: 1.2,
        mitoDysfunction: 1.5,
        cellularSenescence: 1.5,
        inflammation: 1.2,
        // Positive weights (function)
        stemCellFunction: 1.0,
        synapticDensity: 0.8,
        networkActivity: 1.0,
    };
    let weightedHealthSum = 0;
    let totalHealthWeight = 0;
    for (const hallmark in healthWeights) {
        const value = next[hallmark];
        const weight = healthWeights[hallmark];
        const isPositive = ['stemCellFunction', 'synapticDensity', 'networkActivity'].includes(hallmark);
        const score = isPositive ? value : (100 - value);
        weightedHealthSum += score * weight;
        totalHealthWeight += weight;
    }
    next.overallHealth = totalHealthWeight > 0 ? weightedHealthSum / totalHealthWeight : 0;
    
    // 5. Update Lifespan Estimation
    const healthDeclineRate = prev.overallHealth > next.overallHealth ? (prev.overallHealth - next.overallHealth) : 0.001;
    if (healthDeclineRate > 0) {
        const newLifespan = next.age + (next.overallHealth / healthDeclineRate);
        next.lifespan = Number.isFinite(newLifespan) ? newLifespan : prev.lifespan;
    }

    next.age += 1;
    return next;
};


// --- AGING MODELS PER THEORY (WEIGHTINGS) ---
// Each theory now applies a different set of weights to the core simulation, emphasizing its key drivers.
const AGING_FUNCTIONS = {
    stochastic: (prev, effects) => runCoreAgingTick(prev, effects, {
        genomicInstability: 1.5,
        telomereAttrition: 1.2,
        proteostasisLoss: 1.2,
        epigeneticAlterations: 1.0,
        nutrientSensing: 0.8,
        cellularSenescence: 1.0,
        inflammation: 0.8,
    }, 'stochastic'),
    hyperfunction: (prev, effects) => runCoreAgingTick(prev, effects, {
        genomicInstability: 0.8,
        telomereAttrition: 0.7,
        proteostasisLoss: 1.1,
        epigeneticAlterations: 0.7,
        nutrientSensing: 2.5, // The primary, aggressive driver. Should lead to a shorter lifespan.
        cellularSenescence: 1.5,
        inflammation: 1.5,
    }, 'hyperfunction'),
    information: (prev, effects) => runCoreAgingTick(prev, effects, {
        genomicInstability: 1.1, // Epigenetic noise leads to poor DNA repair
        telomereAttrition: 1.0,
        proteostasisLoss: 1.2, // Epigenetic noise leads to protein misfolding
        epigeneticAlterations: 2.0, // The primary driver.
        nutrientSensing: 1.0,
        cellularSenescence: 1.1,
        inflammation: 1.0,
    }, 'information'),
    social: (prev, effects) => runCoreAgingTick(prev, effects, {
        // Lower base rates, but the tipping point mechanic in runCoreAgingTick will cause a rapid collapse later in life.
        genomicInstability: 0.7,
        telomereAttrition: 0.7,
        proteostasisLoss: 0.8,
        epigeneticAlterations: 0.8,
        nutrientSensing: 0.9,
        cellularSenescence: 1.8, // Senescence and inflammation are the key drivers.
        inflammation: 1.8,
    }, 'social'),
};
`;