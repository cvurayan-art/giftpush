const fs = require('fs');
const path = require('path');
const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const cartBodyAndFooter = `      <!-- Cart Items Body -->
      <div class="cart-drawer-body flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 relative">
        <div id="cart-empty-view" class="hidden flex-col items-center justify-center h-full text-center space-y-4">
           <div class="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400 mb-2 mx-auto">
             <i class="w-8 h-8" data-lucide="shopping-bag"></i>
           </div>
           <p class="text-neutral-500 text-sm">Your bag is currently empty.</p>
           <button class="text-[#ff4d61] font-bold text-sm hover:underline" onclick="document.getElementById('btn-close-cart-drawer').click()">Continue Shopping</button>
        </div>
        <div id="cart-items-list" class="space-y-4">
          <!-- Items injected here by TS -->
        </div>
      </div>
      
      <!-- Footer -->
      <div id="cart-footer-section" class="cart-drawer-footer p-5 sm:p-6 border-t border-gray-100 bg-gray-50/50 space-y-4">
        
        <!-- Promo/Discount Row -->
        <div id="cart-discount-row" class="hidden items-center justify-between font-medium text-emerald-600 text-sm">
          <div class="flex items-center gap-2">
            <i class="w-4 h-4" data-lucide="tag"></i>
            <span>Discount</span>
          </div>
          <span id="cart-discount-amount">-$0.00</span>
        </div>
        
        <div id="promo-applied-badge" class="hidden bg-emerald-50 text-emerald-700 p-2 rounded-lg text-xs items-center justify-between">
           <span id="promo-applied-text"></span>
        </div>

        <div class="flex items-center justify-between font-bold text-neutral-900 text-lg">
          <span>Subtotal</span>
          <span id="cart-subtotal-price" class="subtotal-amount">$0.00</span>
        </div>
        <p class="text-xs text-neutral-500 text-center">Taxes and shipping calculated at checkout.</p>
        <button id="cart-checkout-btn" class="w-full bg-[#ff4d61] hover:bg-[#e63e50] text-white py-3.5 sm:py-4 rounded-xl font-bold tracking-wide transition-all shadow-lg hover:shadow-xl hover:shadow-rose-500/20 active:scale-[0.98] flex items-center justify-center gap-2" onclick="window.location.href='/cart.html'">
          <span>Secure Checkout</span>
          <span class="opacity-50">|</span>
          <span id="cart-checkout-btn-total">$0.00</span>
        </button>
      </div>`;

for (const file of files) {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  if (content.includes('id="cart-drawer-panel"')) {
    // Regex to find everything from <!-- Cart Items Body --> to </div>\n  </div>\n  <!-- END: Shopping Cart Slide-out Drawer -->
    const targetRegex = /<!-- Cart Items Body -->[\s\S]*?(?=  <\/div>\s*<!-- END: Shopping Cart Slide-out Drawer -->)/;
    
    if (targetRegex.test(content)) {
      content = content.replace(targetRegex, cartBodyAndFooter + '\n');
      fs.writeFileSync(path.join(dir, file), content);
      console.log('Fixed ' + file);
    } else {
       console.log('Could not find target string in ' + file);
    }
  }
}
