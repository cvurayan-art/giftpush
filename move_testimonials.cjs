const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');

const regex = /(<!-- BEGIN: Testimonials Section -->[\s\S]*?<!-- END: Testimonials Section -->\r?\n?)/;
const match = content.match(regex);

if (match) {
  const testimonials = match[1];
  
  // Remove from original location
  content = content.replace(regex, '');
  
  // Insert before ValuePropositionTrustBar
  content = content.replace('<!-- BEGIN: ValuePropositionTrustBar (Full Width) -->', testimonials + '\n  <!-- BEGIN: ValuePropositionTrustBar (Full Width) -->');
  
  fs.writeFileSync('index.html', content);
  console.log('Successfully moved Testimonials Section.');
} else {
  console.error('Testimonials Section not found!');
  process.exit(1);
}
