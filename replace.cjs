const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');

const headerMatch = indexHtml.match(/(<!-- BEGIN: MainHeader.*?)<!-- END: MainHeader -->/s);
const footerMatch = indexHtml.match(/(<!-- BEGIN: MainFooter.*?)<!-- END: MainFooter -->/s);

if (!headerMatch || !footerMatch) {
  console.error("Header or Footer not found in index.html");
  process.exit(1);
}

const header = headerMatch[1] + "<!-- END: MainHeader -->";
const footer = footerMatch[1] + "<!-- END: MainFooter -->";

const files = ['categories.html', 'collection.html', 'shop.html', 'product.html'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace Header
  content = content.replace(/<!-- MAIN HEADER -->.*?<\/header>/s, header);
  
  // Replace Footer
  content = content.replace(/<!-- FOOTER -->.*?<\/footer>/s, footer);
  
  // Remove Announcement bar
  content = content.replace(/<!-- Top Announcement Bar -->.*?<\/div>\n/s, '');

  // Remove Filters/Compare from shop.html
  if (file === 'shop.html') {
    content = content.replace(/<!-- Search & Sort Row -->.*?<\/div>\n/s, '');
  }

  // Remove Filters/Compare from collection.html
  if (file === 'collection.html') {
    content = content.replace(/<!-- Filter & Sort Bar -->.*?<\/select>\n\s*<\/div>\n\s*<\/div>\n/s, '');
  }

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
