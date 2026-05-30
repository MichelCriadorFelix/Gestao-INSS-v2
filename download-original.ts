import fs from 'fs';

async function run() {
  const branches = ['main', 'master'];
  let success = false;
  let fileContent = '';

  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/MichelCriadorFelix/Gestao-INSS-v2/${branch}/api/index.ts`;
    console.log(`Trying to download from ${url}...`);
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        fileContent = await resp.text();
        console.log(`Success! Downloaded ${fileContent.length} bytes from branch: ${branch}`);
        success = true;
        break;
      } else {
        console.log(`Failed with status: ${resp.status}`);
      }
    } catch (e: any) {
      console.error(`Fetch error for ${branch}:`, e.message);
    }
  }

  if (success) {
    fs.writeFileSync('api/index.ts.backup_restored', fileContent);
    console.log("Written to api/index.ts.backup_restored successfully!");
  } else {
    console.error("Could not download api/index.ts from GitHub repository branches (main/master).");
  }
}

run();
