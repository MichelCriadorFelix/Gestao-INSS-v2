const fs = require('fs');
let content = fs.readFileSync('api/index.ts', 'utf8');

// For Dr. Michel (totalInputTokens)
content = content.replace(
  'const promptTextToEstimate = selectedSystemPrompt + (ragContext || "") + (documentContext || "") + JSON.stringify(historyParts || []);\n      const inputTokens = estimateTokens(promptTextToEstimate);',
  'const inputTokens = totalInputTokens;'
);

// For Dra. Luana (totalInputTokensLuana)
content = content.replace(
  'const promptTextToEstimate = selectedSystemPrompt + (ragContext || "") + (documentContext || "") + JSON.stringify(historyParts || []);\n      const inputTokens = estimateTokens(promptTextToEstimate);',
  'const inputTokens = totalInputTokensLuana;'
);

// For Dr. Felix & Castro (totalInputTokens)
content = content.replace(
  'const promptTextToEstimate = selectedSystemPrompt + (ragContext || "") + (documentContext || "") + JSON.stringify(historyParts || []);\n      const inputTokens = estimateTokens(promptTextToEstimate);',
  'const inputTokens = totalInputTokens;'
);

// For Sec. Fabricia (totalInputTokens)
content = content.replace(
  'const promptTextToEstimate = (selectedSystemPrompt || "") + (finalMessage || "") + JSON.stringify(historyParts || []);\n      const inputTokens = estimateTokens(promptTextToEstimate);',
  'const inputTokens = totalInputTokens;'
);

fs.writeFileSync('api/index.ts', content);
