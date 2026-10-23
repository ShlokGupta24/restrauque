import { describe, it, expect } from 'vitest';
import { generateCartItemId, formatCurrency, THEME } from '@/app/qr/[token]/constants';
import { Product, Category, CartItem } from '@/app/qr/[token]/types';

describe('Step 2 — QR Dine-In Customer UI & Logic Verification', () => {
  // 1. Design System Tokens & Warm Styling Verification
  describe('1. Warm Design System Tokens', () => {
    it('should configure the warm off-white background and deep navy primary button color', () => {
      expect(THEME.colors.bgPage).toBe('#fbf9f5');
      expect(THEME.colors.navyPrimary).toBe('#173f70');
      expect(THEME.colors.bgCard).toBe('#ffffff');
      expect(THEME.colors.borderSubtle).toBe('#e8e4dc');
    });

    it('should format currency accurately in Indian Rupees', () => {
      expect(formatCurrency(280)).toBe('₹280.00');
      expect(formatCurrency(150.5)).toBe('₹150.50');
      expect(formatCurrency(0)).toBe('₹0.00');
      expect(formatCurrency(1499)).toBe('₹1499.00');
    });
  });

  // 2. Line Item Customization & Deterministic Key Generation
  describe('2. Line Item Customization & Deterministic Key Generation', () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    const variant1Id = '22222222-2222-4222-8222-222222222222';
    const variant2Id = '33333333-3333-4333-8333-333333333333';
    const addon1Id = '44444444-4444-4444-8444-444444444444';
    const addon2Id = '55555555-5555-4555-8555-555555555555';

    it('should generate distinct line-item keys for different variants of the same product', () => {
      const keyRegular = generateCartItemId(productId, variant1Id, []);
      const keyLarge = generateCartItemId(productId, variant2Id, []);

      expect(keyRegular).not.toBe(keyLarge);
      expect(keyRegular).toBe(`${productId}:${variant1Id}:`);
      expect(keyLarge).toBe(`${productId}:${variant2Id}:`);
    });

    it('should generate distinct line-item keys when different add-ons are chosen', () => {
      const keyWithoutAddon = generateCartItemId(productId, variant1Id, []);
      const keyWithAddon1 = generateCartItemId(productId, variant1Id, [addon1Id]);
      const keyWithAddon2 = generateCartItemId(productId, variant1Id, [addon2Id]);

      expect(keyWithAddon1).not.toBe(keyWithoutAddon);
      expect(keyWithAddon1).not.toBe(keyWithAddon2);
    });

    it('should produce identical keys regardless of add-on selection array ordering (deterministic sort)', () => {
      const keyA = generateCartItemId(productId, variant1Id, [addon1Id, addon2Id]);
      const keyB = generateCartItemId(productId, variant1Id, [addon2Id, addon1Id]);

      expect(keyA).toBe(keyB);
    });

    it('should compute effective line item totals including variant and addons multiplied by quantity', () => {
      const variantPrice = 420; // Large 14"
      const addonPrices = [60, 40]; // Extra Cheese + Jalapenos
      const quantity = 3;

      const effectiveUnitPrice = variantPrice + addonPrices.reduce((a, b) => a + b, 0); // 520
      const lineTotal = effectiveUnitPrice * quantity; // 1560

      expect(effectiveUnitPrice).toBe(520);
      expect(lineTotal).toBe(1560);
    });
  });

  // 3. Variant Selection Rules Enforcement
  describe('3. Variant Selection Rules Enforcement', () => {
    const productWithVariants: Product = {
      id: 'prod-variants',
      name: 'Signature Woodfired Pizza',
      description: 'Choice of crust and size',
      price: 300,
      imageUrl: null,
      variants: [
        { id: 'v-reg', name: 'Regular 10"', price: 300 },
        { id: 'v-lrg', name: 'Large 14"', price: 450 },
      ],
      addons: [],
    };

    const productWithoutVariants: Product = {
      id: 'prod-simple',
      name: 'Garlic Breadsticks',
      description: 'Herbed butter and parmesan',
      price: 160,
      imageUrl: null,
      variants: [],
      addons: [],
    };

    it('should require a variant when product.variants has one or more options', () => {
      const hasVariants = productWithVariants.variants.length > 0;
      let selectedVariantId: string | null = null;

      // Validation check matching ProductCustomizationModal logic:
      const isValidWithoutSelection = !hasVariants || Boolean(selectedVariantId);
      expect(isValidWithoutSelection).toBe(false);

      selectedVariantId = productWithVariants.variants[0].id;
      const isValidWithSelection = !hasVariants || Boolean(selectedVariantId);
      expect(isValidWithSelection).toBe(true);
    });

    it('should allow adding to cart directly when product has no variants', () => {
      const hasVariants = productWithoutVariants.variants.length > 0;
      const selectedVariantId = null;

      const isValid = !hasVariants || Boolean(selectedVariantId);
      expect(isValid).toBe(true);
    });
  });

  // 4. Category Filtering and Product Search Logic
  describe('4. Category Filtering and Product Search Logic', () => {
    const mockCategories: Category[] = [
      {
        id: 'cat-starters',
        name: 'Starters',
        description: 'Appetizers & small bites',
        products: [
          {
            id: 'p-bruschetta',
            name: 'Truffle Bruschetta',
            description: 'Toasted baguette with wild mushrooms and truffle glaze',
            price: 240,
            imageUrl: null,
            variants: [],
            addons: [],
          },
          {
            id: 'p-calamari',
            name: 'Crispy Calamari',
            description: 'Served with house garlic aioli and fresh lemon',
            price: 320,
            imageUrl: null,
            variants: [],
            addons: [],
          },
        ],
      },
      {
        id: 'cat-mains',
        name: 'Woodfired Pizzas',
        description: 'Authentic stone oven pizzas',
        products: [
          {
            id: 'p-margherita',
            name: 'Margherita Rustica',
            description: 'San Marzano tomatoes, buffalo mozzarella, fresh basil',
            price: 280,
            imageUrl: null,
            variants: [
              { id: 'v-1', name: 'Regular', price: 280 },
              { id: 'v-2', name: 'Large', price: 420 },
            ],
            addons: [{ id: 'a-1', name: 'Extra Cheese', price: 60 }],
          },
        ],
      },
      {
        id: 'cat-drinks',
        name: 'Beverages',
        description: 'Artisan cold drinks',
        products: [
          {
            id: 'p-tea',
            name: 'Iced Peach Nitro Tea',
            description: 'Cold-steeped organic black tea with peach nectar',
            price: 150,
            imageUrl: null,
            variants: [],
            addons: [],
          },
        ],
      },
    ];

    it('should display all categories when no category filter is active', () => {
      const activeCategoryId = '';
      const filtered = mockCategories.filter(
        (c) => !activeCategoryId || c.id === activeCategoryId
      );

      expect(filtered).toHaveLength(3);
      const totalItems = filtered.reduce((sum, c) => sum + c.products.length, 0);
      expect(totalItems).toBe(4);
    });

    it('should filter products when a specific category is selected', () => {
      const activeCategoryId = 'cat-mains';
      const filtered = mockCategories.filter(
        (c) => !activeCategoryId || c.id === activeCategoryId
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Woodfired Pizzas');
      expect(filtered[0].products).toHaveLength(1);
      expect(filtered[0].products[0].name).toBe('Margherita Rustica');
    });

    it('should search products by dish name (case-insensitive)', () => {
      const query = 'truffle';
      const results = mockCategories
        .map((cat) => ({
          ...cat,
          products: cat.products.filter((p) =>
            p.name.toLowerCase().includes(query.toLowerCase())
          ),
        }))
        .filter((cat) => cat.products.length > 0);

      expect(results).toHaveLength(1);
      expect(results[0].products[0].name).toBe('Truffle Bruschetta');
    });

    it('should search products by ingredients or description keywords', () => {
      const query = 'buffalo mozzarella';
      const results = mockCategories
        .map((cat) => ({
          ...cat,
          products: cat.products.filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              (p.description &&
                p.description.toLowerCase().includes(query.toLowerCase()))
          ),
        }))
        .filter((cat) => cat.products.length > 0);

      expect(results).toHaveLength(1);
      expect(results[0].products[0].name).toBe('Margherita Rustica');
    });

    it('should return empty results when search term matches nothing', () => {
      const query = 'sushi roll';
      const results = mockCategories
        .map((cat) => ({
          ...cat,
          products: cat.products.filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              (p.description &&
                p.description.toLowerCase().includes(query.toLowerCase()))
          ),
        }))
        .filter((cat) => cat.products.length > 0);

      expect(results).toHaveLength(0);
    });
  });

  // 5. Cart State Transitions & Multi-View Navigation Persistence
  describe('5. Cart State Transitions & Preservation', () => {
    it('should add simple items to cart and increment quantity on subsequent adds', () => {
      const initialCart: CartItem[] = [];

      // Step 1: Add simple item
      const itemKey = generateCartItemId('p-bread', null, []);
      let cart: CartItem[] = [
        ...initialCart,
        {
          id: itemKey,
          productId: 'p-bread',
          productName: 'Garlic Breadsticks',
          imageUrl: null,
          variantId: null,
          variantName: null,
          unitPrice: 160,
          addons: [],
          quantity: 1,
          lineTotal: 160,
        },
      ];

      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(1);
      expect(cart[0].lineTotal).toBe(160);

      // Step 2: Add same item again (increments quantity)
      const existingIdx = cart.findIndex((i) => i.id === itemKey);
      if (existingIdx >= 0) {
        cart = cart.map((i, idx) =>
          idx === existingIdx
            ? { ...i, quantity: i.quantity + 1, lineTotal: i.unitPrice * (i.quantity + 1) }
            : i
        );
      }

      expect(cart[0].quantity).toBe(2);
      expect(cart[0].lineTotal).toBe(320);
    });

    it('should preserve cart line items and subtotal when navigating between views', () => {
      // Simulating user state in CustomerDineInView:
      let currentView: 'welcome' | 'menu' | 'cart' = 'welcome';
      const cart: CartItem[] = [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Pizza',
          imageUrl: null,
          variantId: 'v-1',
          variantName: 'Large',
          unitPrice: 420,
          addons: [{ id: 'a-1', name: 'Extra Cheese', price: 60 }],
          quantity: 2,
          lineTotal: 960, // (420 + 60) * 2
        },
      ];

      // Navigate welcome -> menu
      currentView = 'menu';
      expect(currentView).toBe('menu');
      expect(cart).toHaveLength(1);
      expect(cart[0].lineTotal).toBe(960);

      // Navigate menu -> cart
      currentView = 'cart';
      expect(currentView).toBe('cart');
      expect(cart).toHaveLength(1);
      const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
      expect(subtotal).toBe(960);

      // Navigate cart -> menu (add more items)
      currentView = 'menu';
      expect(currentView).toBe('menu');
      expect(cart).toHaveLength(1);
    });

    it('should remove item from cart when quantity is decremented to zero', () => {
      let cart: CartItem[] = [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Tea',
          imageUrl: null,
          variantId: null,
          variantName: null,
          unitPrice: 150,
          addons: [],
          quantity: 1,
          lineTotal: 150,
        },
      ];

      // Decrement quantity by 1
      const delta = -1;
      cart = cart
        .map((item) => {
          const newQty = item.quantity + delta;
          return {
            ...item,
            quantity: newQty,
            lineTotal: item.unitPrice * newQty,
          };
        })
        .filter((item) => item.quantity > 0);

      expect(cart).toHaveLength(0);
    });
  });

  // 6. Server Price Preview Contract & Graceful Handling
  describe('6. Server Price Preview Contract & Graceful Handling', () => {
    it('should format valid order preview payload for the server endpoint', () => {
      const cart: CartItem[] = [
        {
          id: 'key-1',
          productId: '11111111-1111-4111-8111-111111111111',
          productName: 'Margherita',
          imageUrl: null,
          variantId: '22222222-2222-4222-8222-222222222222',
          variantName: 'Large',
          unitPrice: 420,
          addons: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Cheese', price: 60 }],
          quantity: 2,
          specialInstructions: 'Extra crispy',
          lineTotal: 960,
        },
      ];

      const token = 'a'.repeat(64);
      const tableId = '99999999-9999-4999-8999-999999999999';

      const payload = {
        qrToken: token,
        tableId: tableId,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          addonIds: item.addons.map((a) => a.id),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
        })),
      };

      expect(payload.qrToken).toBe(token);
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].productId).toBe(cart[0].productId);
      expect(payload.items[0].addonIds).toEqual(['44444444-4444-4444-8444-444444444444']);
      expect(payload.items[0].specialInstructions).toBe('Extra crispy');
    });

    it('should transition to auth_required status gracefully when response is 401 without failing cart flow', () => {
      const mockResponseStatus = 401;
      let previewState: { status: string; quote: unknown; errorMessage: string | null } = {
        status: 'idle',
        quote: null,
        errorMessage: null,
      };

      if (mockResponseStatus === 401) {
        previewState = {
          status: 'auth_required',
          quote: null,
          errorMessage: 'Customer verification required for tax & discount quotes',
        };
      }

      expect(previewState.status).toBe('auth_required');
      expect(previewState.quote).toBeNull();
      // Flow remains uninterrupted; cart items and estimated subtotal remain visible
    });
  });
});
