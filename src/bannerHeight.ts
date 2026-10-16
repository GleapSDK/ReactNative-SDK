/**
 * The space an inline Gleap banner takes at the top of the screen (points on
 * iOS, dp on Android, measured from the top edge; the banner covers the status
 * bar). 0 while no inline banner is shown; floating banners stay at 0.
 */
type Listener = (height: number) => void;

let current = 0;
const listeners = new Set<Listener>();

export const getCurrentBannerHeight = () => current;

export const setCurrentBannerHeight = (height: unknown) => {
  const next =
    typeof height === 'number' && isFinite(height) ? Math.max(0, height) : 0;
  if (next === current) {
    return;
  }
  current = next;
  listeners.forEach((listener) => listener(next));
};

export const subscribeToBannerHeight = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
