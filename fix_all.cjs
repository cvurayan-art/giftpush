const fs = require('fs');
const path = require('path');

const dir = __dirname;
let indexHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// 1. Remove Customer Most Loved from index.html
indexHtml = indexHtml.replace(/<!-- BEGIN: CustomerMostLovedSection.*?<!-- END: CustomerMostLovedSection -->\n?/s, '');

// Save index.html
fs.writeFileSync(path.join(dir, 'index.html'), indexHtml);

// 2. Grab the latest Header, Mobile Drawer, and Footer from index.html
const headerMatch = indexHtml.match(/(<!-- BEGIN: MainHeader.*?)<!-- END: MainHeader -->/s);
const mobileDrawerMatch = indexHtml.match(/(<!-- BEGIN: Mobile Drawer Navigation.*?)<!-- END: Mobile Drawer Navigation -->/s);
const footerMatch = indexHtml.match(/(<!-- BEGIN: MainFooter.*?)<!-- END: MainFooter -->/s);

if (headerMatch && footerMatch && mobileDrawerMatch) {
  const header = headerMatch[1] + "<!-- END: MainHeader -->";
  const drawer = mobileDrawerMatch[1] + "<!-- END: Mobile Drawer Navigation -->";
  const footer = footerMatch[1] + "<!-- END: MainFooter -->";

  // HTML files to update themes
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

  for (const file of files) {
    if (file === 'index.html') continue; // Skip index as it is our source of truth

    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Replace Header
    if (content.includes('<!-- MAIN HEADER -->')) {
      content = content.replace(/<!-- MAIN HEADER -->.*?<\/header>\n*(<!-- END: MainHeader -->)?/s, header + '\n');
    }

    // Replace Mobile Drawer if exists, or append after header
    if (content.includes('<!-- BEGIN: Mobile Drawer Navigation')) {
      content = content.replace(/<!-- BEGIN: Mobile Drawer Navigation.*?<!-- END: Mobile Drawer Navigation -->/s, drawer);
    } else {
      content = content.replace(/(<!-- END: MainHeader -->)/s, '$1\n\n  ' + drawer);
    }

    // Replace Footer
    if (content.includes('<!-- FOOTER -->')) {
      content = content.replace(/<!-- FOOTER -->.*?<\/footer>\n*(<!-- END: MainFooter -->)?/s, footer + '\n');
    }

    // Remove Announcement bar
    content = content.replace(/<!-- Top Announcement Bar -->.*?<\/div>\n/s, '');

    fs.writeFileSync(path.join(dir, file), content);
    console.log(`Updated theme for ${file}`);
  }
}

// 3. Update logo and favicon to FAvicon.png across all files
const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const file of allFiles) {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  let originalContent = content;

  // Replace Festiva Santa Hat or Gold Ribbon with FAvicon.png
  content = content.replace(/\/images\/(Festive%20Santa%20Hat%20PP%20Monogram|Festive%20Gold%20Ribbon%20PP%20Monogram)\.png/g, '/images/FAvicon.png');
  
  // Replace direct favicon href
  content = content.replace(/href="\/favicon\.png"/g, 'href="/images/FAvicon.png"');

  if (content !== originalContent) {
    fs.writeFileSync(path.join(dir, file), content);
    console.log(`Updated logo/favicon in ${file}`);
  }
}

console.log('All tasks completed successfully.');
