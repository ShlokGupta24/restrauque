/**
 * One editable theme contract for every restaurant.
 *
 * The default values are development defaults only. The backend does not yet
 * have confirmed logo/color/font columns on `restaurants`; do not pretend these
 * values are persisted unless a restaurant-theme API/config is implemented.
 *
 * Change this file for local design work. In production, replace the default
 * config with a validated API response from the theme configuration service.
 */
export interface RestaurantThemeConfig {
  restaurantName: string;
  logoUrl?: string;
  primaryColor: string;
  primaryHoverColor: string;
  pageBackground: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  accentColor: string;
  fontFamily: string;
  cardRadius: string;
  buttonRadius: string;
  contentMaxWidth: string;
}

/**
 * Main Restrauque website URL for customer Profile.
 * Must be supplied by the platform owner via VITE_MAIN_WEBSITE_URL.
 * Do not invent a fallback URL. If undefined, the frontend will show
 * a development-only unconfigured indicator.
 */
export const MAIN_RESTRAUQUE_WEBSITE_URL: string | undefined =
  import.meta.env.VITE_MAIN_WEBSITE_URL || undefined;

export const defaultRestaurantTheme: RestaurantThemeConfig = {
  restaurantName: "Restaurant name",
  logoUrl: undefined,
  primaryColor: "#174A82",
  primaryHoverColor: "#103A69",
  pageBackground: "#FCF8ED",
  surfaceColor: "#FFFFFF",
  textColor: "#20201E",
  mutedTextColor: "#6D6D68",
  borderColor: "#D8D5CD",
  accentColor: "#D7B67C",
  fontFamily: "'Inter', system-ui, sans-serif",
  cardRadius: "12px",
  buttonRadius: "10px",
  contentMaxWidth: "1120px",
};

/** Apply a validated theme to a root element; avoid injecting arbitrary CSS. */
export function applyRestaurantTheme(
  theme: RestaurantThemeConfig,
  root: HTMLElement = document.documentElement,
): void {
  const cssVariables: Record<string, string> = {
    "--brand-primary": theme.primaryColor,
    "--brand-primary-hover": theme.primaryHoverColor,
    "--page-background": theme.pageBackground,
    "--surface-color": theme.surfaceColor,
    "--text-color": theme.textColor,
    "--muted-text-color": theme.mutedTextColor,
    "--border-color": theme.borderColor,
    "--accent-color": theme.accentColor,
    "--font-family": theme.fontFamily,
    "--card-radius": theme.cardRadius,
    "--button-radius": theme.buttonRadius,
    "--content-max-width": theme.contentMaxWidth,
  };

  for (const [name, value] of Object.entries(cssVariables)) {
    root.style.setProperty(name, value);
  }
}
