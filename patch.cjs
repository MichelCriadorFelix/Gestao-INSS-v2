const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');

// Disable OpenRouter branch in /api/ocr-unified
code = code.replace(/if \(apiKey \&\& doc\.images \&\& Array\.isArray\(doc\.images\)/g, 'if (false && apiKey && doc.images && Array.isArray(doc.images)');

// Add bypassOpenRouter to callGemini in /api/ocr and /api/ocr-document
code = code.replace(/const response = await callGemini\({([\s\S]*?)config:/g, 'const response = await callGemini({\n      bypassOpenRouter: true,$1config:');

fs.writeFileSync('api/index.ts', code);
