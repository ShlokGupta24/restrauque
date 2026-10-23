import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  RestaurantPublicInfo,
  Category,
  CartItem,
  BillBreakdown,
  CustomerAuthSession,
  Product,
} from '../services/contracts/types';
import { resolveQrContext } from '../services/qrService';
import { ApiClientError } from '../services/apiClient';
import {
  restoreCustomerSession,
  verifyCustomerOtp,
  logoutCustomer,
  type SafeUser,
} from '../services/authService';
import { fetchCustomerMenu } from '../services/menuService';
import {
  fetchOrderPreview,
  mapCartToPreviewItems,
  isValidUuid,
  type AuthoritativeQuote,
} from '../services/orderPreviewService';
import {
  extractStoredOrderId,
  type CustomerOrder,
} from '../services/orderService';
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
  | 'order-history'
  | 'qr-error';

interface AppContextType {
  currentScreen: ScreenId;
  navigateTo: (screen: ScreenId, params?: { productId?: string; orderId?: string }) => void;
  goBack: () => void;
  screenHistory: ScreenId[];
  restaurant: RestaurantPublicInfo | null;
  activeQrToken: string | null;
  qrError: string | null;
  retryQrResolution: () => Promise<void>;
  selectedCategory: string;
  setSelectedCategory: (catId: string) => void;
  menuCategories: Category[];
  menuProducts: Product[];
  isMenuLoading: boolean;
  menuError: string | null;
  loadMenu: (force?: boolean) => Promise<void>;
  getProductById: (productId: string) => Product | null;
  cart: CartItem[];
  addToCart: (product: Product, quantity: number, variantId?: string, selectedAddonIds?: string[], specialInstructions?: string) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  bill: BillBreakdown;
  couponCode: string;
  applyCoupon: (code: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  removeCoupon: () => void;
  orderQuote: AuthoritativeQuote | null;
  isQuoteLoading: boolean;
  quoteError: string | null;
  refreshOrderPreview: () => Promise<void>;
  auth: CustomerAuthSession;
  setAuthPhone: (phone: string, name?: string) => void;
  verifyAndLogin: (otp: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  activeProductId: string | null;
  activeOrderId: string | null;
  setActiveOrderId: (orderId: string | null) => void;
  latestOrder: CustomerOrder | null;
  setLatestOrder: (order: CustomerOrder | null) => void;
  isLoading: boolean;
  setPostAuthScreen: (screen: ScreenId) => void;
  isNavOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function extractQrToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const tokenFromParam = params.get('qr') || params.get('token') || params.get('qrToken');
    if (tokenFromParam && tokenFromParam.trim()) return tokenFromParam.trim();

    const pathMatch = window.location.pathname.match(/\/(?:qr|q)\/([^/?#]+)/);
    if (pathMatch && pathMatch[1] && pathMatch[1].trim()) return decodeURIComponent(pathMatch[1].trim());

    const stored = sessionStorage.getItem('restrauque_active_qr_token');
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // fallback
  }
  return null;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeQrToken, setActiveQrToken] = useState<string | null>(extractQrToken);
  const [qrError, setQrError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('auth-login');
  const [screenHistory, setScreenHistory] = useState<ScreenId[]>(['auth-login']);
  const [postAuthScreen, setPostAuthScreen] = useState<ScreenId>('landing');
  const [restaurant, setRestaurant] = useState<RestaurantPublicInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string>('');

  // Authoritative server-calculated order quote
  const [orderQuote, setOrderQuote] = useState<AuthoritativeQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const previewRequestIdRef = useRef<number>(0);

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

  // Live menu state resolved from backend GET /api/v1/customer/menu
  const [menuCategories, setMenuCategories] = useState<Category[]>([]);
  const [menuProducts, setMenuProducts] = useState<Product[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderIdState] = useState<string | null>(extractStoredOrderId);
  const [latestOrder, setLatestOrder] = useState<CustomerOrder | null>(null);

  const setActiveOrderId = useCallback((id: string | null) => {
    setActiveOrderIdState(id);
    try {
      if (id && isValidUuid(id.trim())) {
        sessionStorage.setItem('restrauque_active_order_id', id.trim());
      } else {
        sessionStorage.removeItem('restrauque_active_order_id');
      }
    } catch {
      // ignore
    }
  }, []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  const openNav = () => setIsNavOpen(true);
  const closeNav = () => setIsNavOpen(false);

  // Initialize Theme, resolve physical QR context with real backend, and check customer Auth session
  useEffect(() => {
    applyRestaurantTheme(defaultRestaurantTheme);

    const controller = new AbortController();

    async function init() {
      // 1. If no QR token exists in URL or session, immediately enter recoverable qr-error state
      if (!activeQrToken) {
        setRestaurant(null);
        setQrError('No table QR code detected. Please scan the QR code located on your dining table to get started.');
        setCurrentScreen('qr-error');
        setScreenHistory(['qr-error']);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setQrError(null);

        // 2. Resolve physical table QR context from backend
        const info = await resolveQrContext(activeQrToken, controller.signal);
        setRestaurant(info);

        // If scanning a DIFFERENT restaurant QR, discard previous table context & cart, but retain auth
        const prevRestaurantId = sessionStorage.getItem('restrauque_active_restaurant_id');
        if (prevRestaurantId && prevRestaurantId !== info.id) {
          setCart([]);
          setCouponCode('');
        }
        sessionStorage.setItem('restrauque_active_restaurant_id', info.id);
        sessionStorage.setItem('restrauque_active_qr_token', activeQrToken);

        // 3. Restore customer authentication session with real backend via GET /api/v1/auth/me
        let activeUser: SafeUser | null = null;
        try {
          activeUser = await restoreCustomerSession(controller.signal);
        } catch (authErr: unknown) {
          if (authErr instanceof ApiClientError && authErr.code === 'ABORTED') {
            return;
          }
          console.warn('Could not restore customer session from backend:', authErr);
          activeUser = null;
        }

        // Check if an explicit screen param was provided (e.g. ?screen=menu for testing)
        const params = new URLSearchParams(window.location.search);
        const explicitScreen = params.get('screen') as ScreenId | null;
        const storedOrderId = extractStoredOrderId();

        if (activeUser) {
          // Check if authenticated user changed across customer sessions
          const prevUserId = sessionStorage.getItem('restrauque_auth_user_id');
          if (prevUserId && prevUserId !== activeUser.id) {
            // Customer changed: purge old customer's order ID, pending attempts, and cart
            sessionStorage.removeItem('restrauque_active_order_id');
            sessionStorage.removeItem('restrauque_pending_order_attempt');
            setActiveOrderId(null);
            setCart([]);
            setCouponCode('');
          }
          sessionStorage.setItem('restrauque_auth_user_id', activeUser.id);

          setAuth({
            phone: activeUser.phone || '',
            customerName: activeUser.name,
            isAuthenticated: true,
            userId: activeUser.id,
          });
          if (storedOrderId) {
            setActiveOrderId(storedOrderId);
          }
          const targetScreen = explicitScreen || (storedOrderId && (explicitScreen === null || explicitScreen === 'order-confirmation') && (params.get('orderId') || params.get('screen') === 'order-confirmation') ? 'order-confirmation' : 'landing');
          setCurrentScreen(targetScreen);
          setScreenHistory([targetScreen]);
        } else {
          setAuth({
            phone: '',
            customerName: undefined,
            isAuthenticated: false,
          });
          // Unauthenticated customer: clear any stored orderId, pending order attempts, and user binding to prevent cross-session leaks
          sessionStorage.removeItem('restrauque_active_order_id');
          sessionStorage.removeItem('restrauque_pending_order_attempt');
          sessionStorage.removeItem('restrauque_auth_user_id');
          setActiveOrderId(null);
          setCurrentScreen('auth-login');
          setScreenHistory(['auth-login']);
        }

        // 4. Fetch live restaurant menu for resolved table context
        setIsMenuLoading(true);
        try {
          const menu = await fetchCustomerMenu(activeQrToken, info.tableId, controller.signal);
          setMenuCategories(menu.categories);
          setMenuProducts(menu.products);
          setMenuError(null);
        } catch (menuErr: unknown) {
          if (menuErr instanceof ApiClientError && menuErr.code === 'ABORTED') {
            return;
          }
          console.warn('Could not load live menu from backend:', menuErr);
          const msg = menuErr instanceof ApiClientError
            ? menuErr.message
            : 'Unable to load restaurant menu. Please check your connection.';
          setMenuError(msg);
          setMenuCategories([]);
          setMenuProducts([]);
        } finally {
          setIsMenuLoading(false);
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError && err.code === 'ABORTED') {
          // Ignore cancelled requests due to component unmount
          return;
        }

        setRestaurant(null);
        setMenuCategories([]);
        setMenuProducts([]);
        setMenuError(null);
        // Clear invalid token from session storage so retry doesn't lock into stale bad token
        sessionStorage.removeItem('restrauque_active_qr_token');

        const message = err instanceof ApiClientError
          ? err.message
          : 'Unable to connect to restaurant service. Please check your connection.';

        setQrError(message);
        setCurrentScreen('qr-error');
        setScreenHistory(['qr-error']);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    return () => {
      controller.abort();
    };
  }, [activeQrToken]);

  const loadMenu = useCallback(async (force = false) => {
    if (!activeQrToken) return;
    if (isMenuLoading && !force) return;

    setIsMenuLoading(true);
    setMenuError(null);
    try {
      const tableId = restaurant?.tableId || null;
      const menu = await fetchCustomerMenu(activeQrToken, tableId);
      setMenuCategories(menu.categories);
      setMenuProducts(menu.products);
      setMenuError(null);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'ABORTED') {
        return;
      }
      const msg = err instanceof ApiClientError
        ? err.message
        : 'Unable to load restaurant menu. Please check your connection and try again.';
      setMenuError(msg);
      setMenuCategories([]);
      setMenuProducts([]);
    } finally {
      setIsMenuLoading(false);
    }
  }, [activeQrToken, restaurant?.tableId, isMenuLoading]);

  const getProductById = useCallback((productId: string): Product | null => {
    return menuProducts.find((p: Product) => p.id === productId) || null;
  }, [menuProducts]);

  const retryQrResolution = useCallback(async () => {
    const latestToken = extractQrToken();
    if (latestToken) {
      setActiveQrToken(latestToken);
    } else {
      setQrError('No table QR code detected. Please scan the QR code located on your dining table to get started.');
      setCurrentScreen('qr-error');
    }
  }, []);

  const refreshOrderPreview = useCallback(async () => {
    const requestId = ++previewRequestIdRef.current;
    setOrderQuote(null);

    if (cart.length === 0) {
      setQuoteError(null);
      setIsQuoteLoading(false);
      setBill({ subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0 });
      return;
    }

    const estimatedSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

    if (!activeQrToken) {
      setQuoteError('No table QR code detected.');
      setIsQuoteLoading(false);
      setBill({ subtotal: estimatedSubtotal, discountAmount: 0, taxAmount: 0, totalAmount: estimatedSubtotal });
      return;
    }

    if (!auth.isAuthenticated) {
      setQuoteError('Customer sign-in required to calculate authoritative taxes, apply coupons, and preview bill.');
      setIsQuoteLoading(false);
      setBill({ subtotal: estimatedSubtotal, discountAmount: 0, taxAmount: 0, totalAmount: estimatedSubtotal });
      return;
    }

    setIsQuoteLoading(true);
    setQuoteError(null);

    try {
      const items = mapCartToPreviewItems(cart);
      const quote = await fetchOrderPreview({
        qrToken: activeQrToken,
        tableId: restaurant?.tableId,
        items,
        couponCode: couponCode || undefined,
      });

      // Ignore stale response if a newer request began
      if (requestId !== previewRequestIdRef.current) return;

      setOrderQuote(quote);
      setQuoteError(null);
      setBill({
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        taxAmount: quote.taxAmount,
        totalAmount: quote.totalAmount,
        appliedCoupon: quote.coupon ? { code: quote.coupon.code, discountValue: quote.discountAmount } : undefined,
      });
    } catch (err: unknown) {
      if (requestId !== previewRequestIdRef.current) return;
      if (err instanceof ApiClientError && err.code === 'ABORTED') return;
      const msg = err instanceof ApiClientError ? err.message : 'Failed to calculate bill.';
      setOrderQuote(null);
      setQuoteError(msg);
      setBill({ subtotal: estimatedSubtotal, discountAmount: 0, taxAmount: 0, totalAmount: estimatedSubtotal });
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setIsQuoteLoading(false);
      }
    }
  }, [cart, activeQrToken, restaurant?.tableId, couponCode, auth.isAuthenticated]);

  // Server-authoritative order preview and pricing effect
  useEffect(() => {
    // Immediately mark prior quote unconfirmed on any input or context change
    setOrderQuote(null);
    const requestId = ++previewRequestIdRef.current;

    if (cart.length === 0) {
      setQuoteError(null);
      setIsQuoteLoading(false);
      setBill({ subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0 });
      return;
    }

    const estimatedSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

    if (!activeQrToken) {
      setQuoteError('No table QR code detected.');
      setIsQuoteLoading(false);
      setBill({ subtotal: estimatedSubtotal, discountAmount: 0, taxAmount: 0, totalAmount: estimatedSubtotal });
      return;
    }

    if (!auth.isAuthenticated) {
      setQuoteError('Customer sign-in required to calculate authoritative taxes, apply coupons, and preview bill.');
      setIsQuoteLoading(false);
      setBill({ subtotal: estimatedSubtotal, discountAmount: 0, taxAmount: 0, totalAmount: estimatedSubtotal });
      return;
    }

    const controller = new AbortController();
    setIsQuoteLoading(true);
    setQuoteError(null);

    const timer = setTimeout(async () => {
      try {
        const items = mapCartToPreviewItems(cart);
        const quote = await fetchOrderPreview(
          {
            qrToken: activeQrToken,
            tableId: restaurant?.tableId,
            items,
            couponCode: couponCode || undefined,
          },
          controller.signal
        );

        // Ignore stale response if a newer request began
        if (requestId !== previewRequestIdRef.current) return;

        setOrderQuote(quote);
        setQuoteError(null);
        setBill({
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          taxAmount: quote.taxAmount,
          totalAmount: quote.totalAmount,
          appliedCoupon: quote.coupon ? { code: quote.coupon.code, discountValue: quote.discountAmount } : undefined,
        });
      } catch (err: unknown) {
        if (requestId !== previewRequestIdRef.current) return;
        if (err instanceof ApiClientError && err.code === 'ABORTED') {
          return;
        }
        const msg = err instanceof ApiClientError ? err.message : 'Failed to calculate order quote.';
        setOrderQuote(null);
        setQuoteError(msg);
        setBill({ subtotal: estimatedSubtotal, discountAmount: 0, taxAmount: 0, totalAmount: estimatedSubtotal });
      } finally {
        if (requestId === previewRequestIdRef.current) {
          setIsQuoteLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cart, couponCode, activeQrToken, restaurant?.tableId, auth.isAuthenticated]);

  const navigateTo = (screen: ScreenId, params?: { productId?: string; orderId?: string }) => {
    setIsNavOpen(false);
    if (params?.productId) setActiveProductId(params.productId);
    if (params?.orderId) {
      setActiveOrderId(params.orderId);
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('screen', screen);
      if (params?.orderId) {
        url.searchParams.set('orderId', params.orderId);
      } else if (screen !== 'order-confirmation') {
        url.searchParams.delete('orderId');
        url.searchParams.delete('order_id');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
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

    const chosenAddons = (product.addons || [])
      .filter((a) => selectedAddonIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, price: a.price }));

    const addonsExtra = chosenAddons.reduce((sum, a) => sum + a.price, 0);
    // Authoritative item price: use selected variant price if available, otherwise base product price
    const baseItemPrice = selectedVariant?.price !== undefined
      ? selectedVariant.price
      : product.price;
    const unitPrice = baseItemPrice + addonsExtra;
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
          basePrice: baseItemPrice,
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
    previewRequestIdRef.current += 1;
    setCart([]);
    setCouponCode('');
    setOrderQuote(null);
    setQuoteError(null);
    setIsQuoteLoading(false);
    setBill({ subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0 });
  };

  const applyCoupon = async (
    code: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const trimmed = code.trim();
    if (!trimmed) {
      removeCoupon();
      return { success: true, message: 'Coupon removed.' };
    }
    if (!auth.isAuthenticated) {
      return { success: false, error: 'Please sign in to apply promo codes.' };
    }
    if (cart.length === 0) {
      return { success: false, error: 'Your cart is empty. Add items first.' };
    }
    if (!activeQrToken) {
      return { success: false, error: 'Table QR code is required to calculate promo discounts.' };
    }

    const requestId = ++previewRequestIdRef.current;
    // Immediately mark prior quote unconfirmed and invalidate any prior quote
    setOrderQuote(null);
    setIsQuoteLoading(true);
    setQuoteError(null);

    const estimatedSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

    try {
      const items = mapCartToPreviewItems(cart);
      const quote = await fetchOrderPreview({
        qrToken: activeQrToken,
        tableId: restaurant?.tableId,
        items,
        couponCode: trimmed,
      });

      // Ignore if a newer request began
      if (requestId !== previewRequestIdRef.current) {
        return { success: false, error: 'Quote calculation was superseded by a newer change.' };
      }

      setCouponCode(trimmed);
      setOrderQuote(quote);
      setQuoteError(null);
      setBill({
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        taxAmount: quote.taxAmount,
        totalAmount: quote.totalAmount,
        appliedCoupon: quote.coupon
          ? { code: quote.coupon.code, discountValue: quote.discountAmount }
          : undefined,
      });
      return {
        success: true,
        message: `Coupon "${trimmed.toUpperCase()}" applied! Saved ₹${quote.discountAmountFormatted}.`,
      };
    } catch (err: unknown) {
      if (requestId === previewRequestIdRef.current) {
        // Backend rejected coupon or network error: invalidate any prior coupon and quote
        setCouponCode('');
        setOrderQuote(null);
        const msg = err instanceof ApiClientError ? err.message : 'Invalid or expired promo code.';
        setQuoteError(msg);
        setBill({
          subtotal: estimatedSubtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: estimatedSubtotal,
        });
      }
      const msg = err instanceof ApiClientError ? err.message : 'Invalid or expired promo code.';
      return { success: false, error: msg };
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setIsQuoteLoading(false);
      }
    }
  };

  const removeCoupon = () => {
    previewRequestIdRef.current += 1;
    setOrderQuote(null);
    setCouponCode('');
  };

  const setAuthPhone = (phone: string, name?: string) => {
    setAuth((prev) => ({
      ...prev,
      phone,
      ...(name !== undefined ? { customerName: name } : {}),
    }));
  };

  const verifyAndLogin = async (
    otp: string,
    name?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!auth.phone) {
      return { success: false, error: 'Mobile number is missing. Please restart login.' };
    }

    try {
      const customerNameToSubmit = name || auth.customerName;
      const res = await verifyCustomerOtp(auth.phone, otp, customerNameToSubmit);
      setAuth({
        phone: res.user.phone || auth.phone,
        customerName: res.user.name,
        isAuthenticated: true,
        userId: res.user.id,
      });
      const targetScreen = postAuthScreen || 'landing';
      setPostAuthScreen('landing');
      setScreenHistory((prev) => [...prev, targetScreen]);
      setCurrentScreen(targetScreen);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { success: true };
    } catch (e: unknown) {
      const errorMsg = e instanceof ApiClientError
        ? e.message
        : 'Invalid or expired verification code. Please check and try again.';
      return { success: false, error: errorMsg };
    }
  };

  const logout = async (): Promise<void> => {
    previewRequestIdRef.current += 1;
    setOrderQuote(null);
    setQuoteError(null);
    setCouponCode('');
    setActiveOrderId(null);
    setLatestOrder(null);
    try {
      sessionStorage.removeItem('restrauque_active_order_id');
      sessionStorage.removeItem('restrauque_pending_order_attempt');
      sessionStorage.removeItem('restrauque_auth_user_id');
      const url = new URL(window.location.href);
      url.searchParams.delete('orderId');
      url.searchParams.delete('order_id');
      if (url.searchParams.get('screen') === 'order-confirmation') {
        url.searchParams.delete('screen');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
    setIsLoading(true);
    try {
      await logoutCustomer();
      setAuth({
        phone: '',
        customerName: undefined,
        isAuthenticated: false,
      });
      setScreenHistory(['auth-login']);
      setCurrentScreen('auth-login');
    } catch (e: unknown) {
      console.error('Logout failed:', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
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
        qrError,
        retryQrResolution,
        selectedCategory,
        setSelectedCategory,
        menuCategories,
        menuProducts,
        isMenuLoading,
        menuError,
        loadMenu,
        getProductById,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        bill,
        couponCode,
        applyCoupon,
        removeCoupon,
        orderQuote,
        isQuoteLoading,
        quoteError,
        refreshOrderPreview,
        auth,
        setAuthPhone,
        verifyAndLogin,
        logout,
        activeProductId,
        activeOrderId,
        setActiveOrderId,
        latestOrder,
        setLatestOrder,
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
