import fs from 'fs';
try {
  fs.copyFileSync('api/index.ts.backup_restored', 'api/index.ts');
  console.log("api/index.ts successfully replaced with pristine GitHub version!");
} catch (e: any) {
  console.error("Replacement failed:", e.message);
}
