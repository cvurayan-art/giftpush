const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

let replacedCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Remove brightness-0 invert from the logo img tags
  content = content.replace(/(src="\/images\/Festive%20Gold%20Ribbon%20PP%20Monogram\.png"[^>]*?)(\s?brightness-0\s?invert\s?)([^>]*>)/g, '$1$3');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
    replacedCount++;
  }
}

console.log(`Done. Updated ${replacedCount} files.`);
