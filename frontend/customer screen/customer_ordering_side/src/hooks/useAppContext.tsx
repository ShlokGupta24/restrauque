import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  RestaurantPublicInfo,
  CartItem,
  BillBreakdown,
  CustomerAuthSession,
  Product,
} from '../services/contracts/types';
import { customerDataService } from '../services';
import { defaultRestaurantTheme, applyRestaurantTheme } from '../config/restaurantTheme';

export type ScreenId =
  | 'landing'
  | 'menu'
  | 'product-detail'
  | 'cart'
  | 'auth-login'
  | 'auth-otp'
  | 'checkout'
  | 'order-confirmation'
  | 'feedback'
  | 'order-history';

interface AppContextType {
  currentScreen: ScreenId;
  navigateTo: (screen: ScreenId, params?: { productId?: string; orderId?: string }) => void;
  goBack: () => void;
  screenHistory: ScreenId[];
  restaurant: RestaurantPublicInfo | null;
  activeQrToken: string;
  selectedCategory: string;
  setSelectedCategory: (catId: string) => void;
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, variantId?: string, selectedAddonIds?: string[], specialInstructions?: string) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  bill: BillBreakdown;
  couponCode: string;
  applyCoupon: (code: string) => Promise<boolean>;
  auth: CustomerAuthSession;
  setAuthPhone: (phone: string) => void;
  verifyAndLogin: (otp: string) => Promise<boolean>;
  logout: () => void;
  activeProductId: string | null;
  activeOrderId: string | null;
  setActiveOrderId: (orderId: string | null) => void;
  isLoading: boolean;
  setPostAuthScreen: (screen: ScreenId) => void;
  isNavOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function extractQrToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const tokenFromParam = params.get('qr') || params.get('token') || params.get('qrToken');
    if (tokenFromParam) return tokenFromParam;

    const pathMatch = window.location.pathname.match(/\/(?:qr|q)\/([^/?#]+)/);
    if (pathMatch && pathMatch[1]) return decodeURIComponent(pathMatch[1]);

    const stored = sessionStorage.getItem('restrauque_active_qr_token');
    if (stored) return stored;
  } catch {
    // fallback
  }
  return 'demo-qr-token';
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeQrToken] = useState<string>(extractQrToken);
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('auth-login');
  const [screenHistory, setScreenHistory] = useState<ScreenId[]>(['auth-login']);
  const [postAuthScreen, setPostAuthScreen] = useState<ScreenId>('landing');
  const [restaurant, setRestaurant] = useState<RestaurantPublicInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string>('');

  const [bill, setBill] = useState<BillBreakdown>({
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  // Auth state initialized without storing raw tokens in localStorage
  const [auth, setAuth] = useState<CustomerAuthSession>({
    phone: '',
    isAuthenticated: false,
  });

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  const openNav = () => setIsNavOpen(true);
  const closeNav = () => setIsNavOpen(false);

  // Initialize Theme, verify Auth session via HttpOnly cookie/backend, and resolve QR context
  useEffect(() => {
    applyRestaurantTheme(defaultRestaurantTheme);

    async function init() {
      try {
        setIsLoading(true);

        // 1. Resolve physical QR context
        const info = await customerDataService.resolveQrContext(activeQrToken);
        setRestaurant(info);

        // If scanning a DIFFERENT restaurant QR, discard previous table context & cart, but retain auth
        const prevRestaurantId = sessionStorage.getItem('restrauque_active_restaurant_id');
        if (prevRestaurantId && prevRestaurantId !== info.id) {
          setCart([]);
          setCouponCode('');
        }
        sessionStorage.setItem('restrauque_active_restaurant_id', info.id);
        sessionStorage.setItem('restrauque_active_qr_token', activeQrToken);

        // 2. Verify customer authentication session with backend
        const session = await customerDataService.checkAuthSession();

        // Check if an explicit screen param was provided (e.g. ?screen=menu for testing)
        const params = new URLSearchParams(window.location.search);
        const explicitScreen = params.get('screen') as ScreenId | null;

        if (session.isAuthenticated) {
          setAuth({
            phone: session.phone || '',
            customerName: session.customerName,
            isAuthenticated: true,
          });
          const targetScreen = explicitScreen || 'landing';
          setCurrentScreen(targetScreen);
          setScreenHistory([targetScreen]);
        } else {
          setAuth({
            phone: '',
            isAuthenticated: false,
          });
          // Login comes first after QR scan if unauthenticated
          setCurrentScreen('auth-login');
          setScreenHistory(['auth-login']);
        }
      } catch (err) {
        console.error('Failed to initialize application context:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [activeQrToken]);

  // Recalculate bill whenever cart or coupon changes
  useEffect(() => {
    async function updateBill() {
      try {
        const calculated = await customerDataService.calculateBill(cart, couponCode);
        setBill(calculated);
      } catch (err) {
        console.error('Failed to calculate bill:', err);
      }
    }
    updateBill();
  }, [cart, couponCode]);

  const navigateTo = (screen: ScreenId, params?: { productId?: string; orderId?: string }) => {
    setIsNavOpen(false);
    if (params?.productId) setActiveProductId(params.productId);
    if (params?.orderId) setActiveOrderId(params.orderId);
    setScreenHistory((prev) => [...prev, screen]);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (screenHistory.length > 1) {
      const nextHistory = [...screenHistory];
      nextHistory.pop();
      const prevScreen = nextHistory[nextHistory.length - 1];
      setScreenHistory(nextHistory);
      setCurrentScreen(prevScreen);
    } else {
      setCurrentScreen('landing');
    }
  };

  const addToCart = (
    product: Product,
    quantity: number,
    variantId?: string,
    selectedAddonIds: string[] = [],
    specialInstructions?: string
  ) => {
    const selectedVariant = product.variants?.find((v) => v.id === variantId) || product.variants?.[0];
    const variantExtra = selectedVariant?.priceDelta || 0;

    const chosenAddons = (product.addons || [])
      .filter((a) => selectedAddonIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, price: a.price }));

    const addonsExtra = chosenAddons.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = product.price + variantExtra + addonsExtra;
    const cartItemId = `${product.id}-${selectedVariant?.id || 'default'}-${selectedAddonIds.sort().join('_')}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          totalPrice: newQty * unitPrice,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: cartItemId,
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl,
          basePrice: product.price,
          variant: selectedVariant
            ? { id: selectedVariant.id, name: selectedVariant.name, priceDelta: selectedVariant.priceDelta }
            : undefined,
          addons: chosenAddons,
          quantity,
          specialInstructions,
          unitPrice,
          totalPrice: unitPrice * quantity,
        },
      ];
    });
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0
              ? { ...item, quantity: nextQty, totalPrice: nextQty * item.unitPrice }
              : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setCouponCode('');
  };

  const applyCoupon = async (code: string): Promise<boolean> => {
    setCouponCode(code);
    return true;
  };

  const setAuthPhone = (phone: string) => {
    setAuth((prev) => ({ ...prev, phone }));
  };

  const verifyAndLogin = async (otp: string): Promise<boolean> => {
    try {
      const res = await customerDataService.verifyOtp(auth.phone, otp);
      if (res.success) {
        setAuth({
          phone: auth.phone,
          customerName: res.user?.name,
          isAuthenticated: true,
        });
        const targetScreen = postAuthScreen || 'landing';
        setPostAuthScreen('landing');
        setScreenHistory((prev) => [...prev, targetScreen]);
        setCurrentScreen(targetScreen);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      }
    } catch (e) {
      console.warn('Login verification failed', e);
    }
    return false;
  };

  const logout = async () => {
    try {
      await customerDataService.logout();
    } catch (e) {
      console.warn('Could not clear auth session', e);
    }
    setAuth({
      phone: '',
      isAuthenticated: false,
    });
    setScreenHistory(['auth-login']);
    setCurrentScreen('auth-login');
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        navigateTo,
        goBack,
        screenHistory,
        restaurant,
        activeQrToken,
        selectedCategory,
        setSelectedCategory,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        bill,
        couponCode,
        applyCoupon,
        auth,
        setAuthPhone,
        verifyAndLogin,
        logout,
        activeProductId,
        activeOrderId,
        setActiveOrderId,
        isLoading,
        setPostAuthScreen,
        isNavOpen,
        openNav,
        closeNav,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
