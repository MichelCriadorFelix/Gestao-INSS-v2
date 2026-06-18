const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

// Replace all occurrences of "[FASE DE TOMADA DE CIÊNCIA]" with "FASE DE TOMADA DE CIÊNCIA" in includes()
code = code.replace(/includes\("\[FASE DE TOMADA DE CIÊNCIA\]"\)/g, 'includes("FASE DE TOMADA DE CIÊNCIA")');
code = code.replace(/includes\('\[FASE DE TOMADA DE CIÊNCIA\]'\)/g, 'includes("FASE DE TOMADA DE CIÊNCIA")');

fs.writeFileSync('api/index.ts', code);
