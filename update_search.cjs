const fs = require('fs');
const path = require('path');

const dir = __dirname;
let indexHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// 1. Redesign the search modal in index.html to be a sleek top-dropdown overlay
const sleekSearchModal = `<!-- ========================================== -->
  <!-- 4. LIVE INTERACTIVE SEARCH MODAL           -->
  <!-- ========================================== -->
  <div id="search-modal-overlay" class="fixed inset-0 z-[130] bg-neutral-900/60 backdrop-blur-md hidden items-start justify-center pt-0" role="dialog" aria-modal="true" aria-label="Search Gift Catalog">
    <div class="relative w-full max-w-5xl bg-white shadow-2xl p-6 sm:p-12 border-b border-neutral-100 transition-all duration-500 max-h-[85vh] flex flex-col rounded-b-[2rem] transform-gpu origin-top animate-in slide-in-from-top-4 fade-in">
      <button id="btn-close-search-modal" aria-label="Close search modal" class="absolute top-6 right-6 sm:top-8 sm:right-8 w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition cursor-pointer">
        <i class="w-5 h-5" data-lucide="x"></i>
      </button>

      <div class="flex flex-col items-center justify-center mb-8 w-full max-w-3xl mx-auto text-center">
        <h3 class="font-extrabold text-neutral-950 text-2xl sm:text-3xl tracking-tight mb-2">What are you looking for?</h3>
        <p class="text-sm text-neutral-500">Discover premium gifts, trendy gadgets, and keepsakes.</p>
      </div>

      <!-- Search Input Box -->
      <div class="relative w-full max-w-3xl mx-auto mb-6">
        <i class="w-6 h-6 text-neutral-400 absolute left-5 top-1/2 -translate-y-1/2" data-lucide="search"></i>
        <input type="text" id="live-search-input" placeholder="Type a product name or category..." class="w-full text-base sm:text-lg bg-gray-50 border-2 border-transparent focus:border-[#0B2D19] rounded-2xl py-4 pl-14 pr-12 outline-none transition-all duration-300 font-medium" autocomplete="off">
        <button id="btn-clear-search" type="button" class="hidden absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xl font-bold cursor-pointer">&times;</button>
      </div>

      <!-- Popular Suggestion Chips -->
      <div class="flex items-center justify-center gap-2 flex-wrap mb-6 pb-6 border-b border-gray-100 text-sm w-full max-w-3xl mx-auto">
        <span class="text-neutral-400 font-semibold mr-2">Trending:</span>
        <button class="search-tag-chip bg-rose-50 text-[#ff4d61] hover:bg-rose-100 px-4 py-1.5 rounded-full font-bold transition cursor-pointer" data-tag="Shark">Baby Shark</button>
        <button class="search-tag-chip bg-gray-100 text-neutral-700 hover:bg-gray-200 px-4 py-1.5 rounded-full font-bold transition cursor-pointer" data-tag="Watch">Apple Watch</button>
        <button class="search-tag-chip bg-gray-100 text-neutral-700 hover:bg-gray-200 px-4 py-1.5 rounded-full font-bold transition cursor-pointer" data-tag="Coffee">Coffee Maker</button>
      </div>

      <!-- Search Results Area -->
      <div id="live-search-results" class="flex-1 overflow-y-auto space-y-3 no-scrollbar max-h-80 w-full max-w-3xl mx-auto">
        <!-- Results rendered here -->
      </div>
    </div>
  </div>
  <!-- END: Live Search Modal -->`;

indexHtml = indexHtml.replace(/<!-- ========================================== -->\s*<!-- 4\. LIVE INTERACTIVE SEARCH MODAL           -->.*?<!-- END: Live Search Modal -->/s, sleekSearchModal);
fs.writeFileSync(path.join(dir, 'index.html'), indexHtml);

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  if (file === 'index.html') continue;
  let content = fs.readFileSync(path.join(dir, file), 'utf8');

  // If other files have the OLD shop.html search modal block, we completely remove it because we will append the new one from index.html
  content = content.replace(/<!-- Search Modal -->.*?<\/div>\n\s*<\/div>\n/s, '');
  content = content.replace(/<div id="search-modal".*?<\/div>\n\s*<\/div>\n/s, '');

  // If it already has the new search modal, replace it
  if (content.includes('<!-- 4. LIVE INTERACTIVE SEARCH MODAL')) {
    content = content.replace(/<!-- ========================================== -->\s*<!-- 4\. LIVE INTERACTIVE SEARCH MODAL           -->.*?<!-- END: Live Search Modal -->/s, sleekSearchModal);
  } else {
    // Inject it right before the GIFT FINDER QUIZ MODAL or right before </body>
    if (content.includes('<!-- BEGIN: GIFT FINDER QUIZ MODAL')) {
      content = content.replace('<!-- BEGIN: GIFT FINDER QUIZ MODAL', sleekSearchModal + '\n\n  <!-- BEGIN: GIFT FINDER QUIZ MODAL');
    } else {
      content = content.replace('</body>', sleekSearchModal + '\n</body>');
    }
  }

  // Also fix "See All Products" link in all files (though it might only be in index.html)
  content = content.replace(/href="#flash-deals"/g, 'href="/shop.html"');
  content = content.replace(/href="#customer-loved"/g, 'href="/shop.html"');

  // Fix Javascript to use new search modal ID if needed.
  // The JS in storefront.ts or index.html handles the search open.

  fs.writeFileSync(path.join(dir, file), content);
  console.log(`Updated search modal in ${file}`);
}
