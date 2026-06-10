import { execSync } from 'child_process';
try {
  console.log("Searching for .git recursively from root/parent...");
  const out = execSync('find / -maxdepth 3 -name ".git" 2>/dev/null', { encoding: 'utf-8' });
  console.log("Git folders found:\n", out);
} catch (e: any) {
  console.error("Search failed:", e.message);
}
