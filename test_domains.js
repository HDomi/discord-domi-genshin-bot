const genshindb = require('genshin-db');

console.log('Categories:', Object.keys(genshindb));

// Test domains
try {
    const domains = genshindb.domains('names', { matchCategories: true });
    console.log('Domains:', domains ? domains.slice(0, 5) : 'None');
    
    // Get details of a domain
    if (domains && domains.length > 0) {
        console.log('Domain Details:', genshindb.domains(domains[0]));
    }
} catch (e) {
    console.error('Error with domains:', e.message);
}

// Test talents
try {
    const talents = genshindb.talents('names', { matchCategories: true });
    console.log('Talents:', talents ? talents.slice(0, 5) : 'None');
} catch (e) {
    console.error('Error with talents:', e.message);
}

// Test materials
try {
    const materials = genshindb.materials('names', { matchCategories: true });
    console.log('Materials:', materials ? materials.slice(0, 5) : 'None');
    
    if (materials && materials.length > 0) {
        console.log('Material Details:', genshindb.materials(materials[0]));
    }
} catch (e) {
    console.error('Error with materials:', e.message);
}
