export const ORGANOID_SIMULATION_CODE = `
// --- THEORIES OF AGING CONFIGURATION ---
const THEORIES = {
    stochastic: { name: 'Stochastic Damage', description: 'Aging is the result of accumulating random damage to cells.', stats: ['dnaDamage', 'mitoEfficiency', 'proteostasisQuality', 'oxidativeStress', 'extracellularWaste', 'networkActivity', 'synapticDensity', 'senescentCellBurden'] },
    hyperfunction: { name: 'Programmed Hyperfunction', description: 'Aging is a continuation of a developmental program that becomes harmful.', stats: ['developmentalSignalStrength', 'cellularHypertrophy', 'mitoEfficiency', 'oxidativeStress', 'proteostasisQuality', 'inflammationLevel', 'synapticDensity', 'networkActivity'] },
    information: { name: 'Information Entropy', description: 'Aging is the loss of epigenetic information and cellular identity.', stats: ['epigeneticNoise', 'misexpressionChance', 'proteostasisQuality', 'mitoEfficiency', 'dnaDamage', 'networkActivity', 'senescentCellBurden', 'synapticDensity'] },
    social: { name: 'Cellular Society Collapse', description: 'Aging is caused by "bad actor" cells disrupting tissue function.', stats: ['senescentCellBurden', 'inflammationLevel', 'stemCellPool', 'microgliaState', 'extracellularWaste', 'synapticDensity', 'networkActivity', 'dnaDamage'] },
};
const THEORY_KEYS = Object.keys(THEORIES);

// --- ORGANOID STATE & SIMULATION ---
const getInitialOrganoidState = () => ({
    // Foundational stats
    age: 0,
    lifespan: 120,
    overallHealth: 100,
    totalCellCount: 1000000,
    // Theory 1: Stochastic Damage
    dnaDamage: 0,
    mitoEfficiency: 100,
    proteostasisQuality: 100,
    oxidativeStress: 0,
    extracellularWaste: 0,
    // Theory 2: Programmed Hyperfunction
    developmentalSignalStrength: 5,
    cellularHypertrophy: 0,
    // Theory 3: Information Entropy
    epigeneticNoise: 0,
    misexpressionChance: 0,
    // Theory 4: Cellular Society
    senescentCellBurden: 0,
    inflammationLevel: 0,
    stemCellPool: 100,
    microgliaState: 0, // 0 for surveilling, 1 for reactive
    // Shared functional params
    synapticDensity: 100,
    networkActivity: 100,
});

const getInitialStates = () => ({
    stochastic: getInitialOrganoidState(),
    hyperfunction: getInitialOrganoidState(),
    information: getInitialOrganoidState(),
    social: getInitialOrganoidState(),
});

// --- AGING MODELS PER THEORY ---
const runStochasticAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 300);
    let dnaDamageIncrease = (0.05 * ageFactor) / effects.dnaRepairRate;
    const mitoDecline = 0.06 * ageFactor;
    const newMitoEfficiency = Math.max(0, prev.mitoEfficiency - mitoDecline);
    let oxStressIncrease = (0.1 * ageFactor) + ((100 - newMitoEfficiency) / 100 * 0.2);
    const proteostasisDecline = 0.05 * ageFactor;
    const newProteostasisQuality = Math.max(0, prev.proteostasisQuality - proteostasisDecline);
    const wasteIncrease = (100 - newProteostasisQuality) / 100 * 0.2;
    dnaDamageIncrease += (prev.oxidativeStress / 100) * 0.15;
    let senescentIncrease = prev.dnaDamage > (80 - (newAge / 10)) ? 0.1 * ageFactor : 0;
    
    const health = (
        ((100 - Math.min(100, prev.dnaDamage + dnaDamageIncrease)) * 0.3) +
        (newMitoEfficiency * 0.2) +
        (newProteostasisQuality * 0.2) +
        ((100 - prev.senescentCellBurden) * 0.1) +
        ((100 - prev.inflammationLevel) * 0.1) +
        ((100 - prev.oxidativeStress) * 0.1)
    );
    return {...prev, age:newAge, overallHealth: health, dnaDamage: Math.min(100, prev.dnaDamage + dnaDamageIncrease), mitoEfficiency: newMitoEfficiency, proteostasisQuality: newProteostasisQuality, oxidativeStress: Math.min(100, prev.oxidativeStress + oxStressIncrease / effects.antioxidantCapacity), extracellularWaste: Math.min(100, (prev.extracellularWaste + wasteIncrease) / effects.autophagyBoost), senescentCellBurden: Math.min(100, prev.senescentCellBurden + senescentIncrease) };
};

const runHyperfunctionAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 400);
    const newSignalStrength = Math.min(100, (prev.developmentalSignalStrength + (0.1 * ageFactor)) / effects.signalInhibition);
    const newHypertrophy = Math.min(100, prev.cellularHypertrophy + (newSignalStrength / 100 * 0.3));
    const newMitoEfficiency = Math.max(0, prev.mitoEfficiency - (newHypertrophy / 100 * 0.1));
    const newOxStress = Math.min(100, prev.oxidativeStress + (newHypertrophy / 100 * 0.2));
    
    const health = (
        ((100 - newSignalStrength) * 0.4) +
        ((100 - newHypertrophy) * 0.3) +
        (newMitoEfficiency * 0.15) +
        ((100 - newOxStress) * 0.15)
    );
    return {...prev, age:newAge, overallHealth: health, developmentalSignalStrength: newSignalStrength, cellularHypertrophy: newHypertrophy, mitoEfficiency: newMitoEfficiency, oxidativeStress: newOxStress};
};

const runInformationAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 350);
    const newEpigeneticNoise = Math.min(100, (prev.epigeneticNoise + (0.08 * ageFactor)) / effects.epigeneticStabilization);
    const newMisexpressionChance = Math.min(100, prev.misexpressionChance + (newEpigeneticNoise / 100 * 0.2));
    const newProteostasisQuality = Math.max(0, prev.proteostasisQuality - (newMisexpressionChance / 100 * 0.05));
    const newMitoEfficiency = Math.max(0, prev.mitoEfficiency - (newMisexpressionChance / 100 * 0.05));

    const health = (
        ((100 - newEpigeneticNoise) * 0.5) +
        ((100 - newMisexpressionChance) * 0.2) +
        (newProteostasisQuality * 0.15) +
        (newMitoEfficiency * 0.15)
    );
    return {...prev, age:newAge, overallHealth: health, epigeneticNoise: newEpigeneticNoise, misexpressionChance: newMisexpressionChance, proteostasisQuality: newProteostasisQuality, mitoEfficiency: newMitoEfficiency };
};

const runSocialAging = (prev, effects) => {
    const newAge = prev.age + 1;
    const ageFactor = 1 + (newAge / 250);
    const newSenescentBurden = Math.min(100, prev.senescentCellBurden + (0.15 * ageFactor));
    const newInflammation = Math.min(100, prev.inflammationLevel + (newSenescentBurden / 100 * 0.4));
    const newStemCellPool = Math.max(0, prev.stemCellPool - (newInflammation / 100 * 0.2));
    const newMicrogliaState = newInflammation > 50 ? 1 : 0;
    const newDnaDamage = Math.min(100, prev.dnaDamage + (newInflammation/100 * 0.1));

    const health = (
        ((100 - newSenescentBurden) * 0.4) +
        ((100 - newInflammation) * 0.3) +
        (newStemCellPool * 0.2) +
        ((100-newDnaDamage) * 0.1)
    );
    return {...prev, age:newAge, overallHealth: health, senescentCellBurden: newSenescentBurden, inflammationLevel: newInflammation, stemCellPool: newStemCellPool, microgliaState: newMicrogliaState, dnaDamage: newDnaDamage };
};

const AGING_FUNCTIONS = {
    stochastic: runStochasticAging,
    hyperfunction: runHyperfunctionAging,
    information: runInformationAging,
    social: runSocialAging,
};
`;