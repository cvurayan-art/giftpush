const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

let replacedCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace old monogram with new santa hat monogram
  content = content.replace(/Festive%20Gold%20Ribbon%20PP%20Monogram\.png/g, 'Festive%20Santa%20Hat%20PP%20Monogram.png');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
    replacedCount++;
  }
}

console.log(`Done. Updated ${replacedCount} files.`);
