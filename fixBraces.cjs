const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

// Replace any trailing extra closing braces after systemState block
content = content.replace(/(\s*if \(systemState\.clients && systemState\.clients\.length > 0\) \{[\s\S]*?\}[\s\S]*?\})(\s*\})+(\s*if \(history\.length > 40\))/g, '$1\n\n    $3');

fs.writeFileSync('api/index.ts', content);
console.log('Fixed extra braces!');
