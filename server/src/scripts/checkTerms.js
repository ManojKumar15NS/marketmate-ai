const fs = require('fs');
const path = require('path');

function searchFiles(dir, filter) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        results = results.concat(searchFiles(full, filter));
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      if (filter(content, full)) {
        results.push(full);
      }
    }
  }
  return results;
}

const terms = ['pricing', 'credit', 'billing', 'subscription', 'free tier', 'upgrade plan'];
for (const term of terms) {
  const matches = searchFiles('C:/Users/Manoj Kumarn N S/.gemini/antigravity/scratch/marketmate-ai/client/src', (content) => content.toLowerCase().includes(term));
  console.log('Term "' + term + '": ' + matches.length + ' matches');
  for (const m of matches) {
    console.log('   -> ' + path.basename(m));
  }
}
