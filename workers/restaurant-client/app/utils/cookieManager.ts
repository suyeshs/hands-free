/**
 * Cookie Manager for Voice Ordering User Sessions
 * Tracks user name, last order, and preferences across visits
 * Cookie-based identification (not phone number)
 */

export interface UserSession {
  sessionId: string;
  userName: string;
  phone?: string;
  lastVisit: string;
  lastOrder?: {
    items: Array<{
      name: string;
      customization?: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    date: string;
  };
  preferences?: {
    dietary?: 'vegetarian' | 'non-veg' | 'vegan';
    favoriteCategories?: string[];
  };
}

const COOKIE_NAME = 'voice_ordering_session';
const COOKIE_EXPIRY_DAYS = 90;

export const SessionCookieManager = {
  /**
   * Get current user session from cookie
   */
  get(): UserSession | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAME}=`));

    if (!sessionCookie) return null;

    try {
      const cookieValue = sessionCookie.split('=')[1];
      const decoded = decodeURIComponent(cookieValue);
      return JSON.parse(decoded) as UserSession;
    } catch (error) {
      console.error('[SessionCookieManager] Failed to parse session cookie:', error);
      return null;
    }
  },

  /**
   * Set user session cookie
   */
  set(session: UserSession): void {
    if (typeof document === 'undefined') return;

    const encoded = encodeURIComponent(JSON.stringify(session));
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);

    document.cookie = `${COOKIE_NAME}=${encoded}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
  },

  /**
   * Update session with partial data
   */
  update(partial: Partial<UserSession>): void {
    const currentSession = this.get();
    if (!currentSession) {
      console.warn('[SessionCookieManager] Cannot update: no session exists');
      return;
    }

    const updatedSession: UserSession = {
      ...currentSession,
      ...partial,
      lastVisit: new Date().toISOString(),
    };

    this.set(updatedSession);
  },

  /**
   * Clear session cookie
   */
  clear(): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  },

  /**
   * Check if user is returning visitor
   */
  isReturningUser(): boolean {
    const session = this.get();
    return session !== null && session.userName !== undefined;
  },

  /**
   * Create new session for first-time user
   */
  createNew(userName: string): UserSession {
    const session: UserSession = {
      sessionId: this.generateSessionId(),
      userName,
      lastVisit: new Date().toISOString(),
    };

    this.set(session);
    return session;
  },

  /**
   * Update last order after checkout
   */
  saveLastOrder(order: {
    items: Array<{
      name: string;
      customization?: string;
      quantity: number;
      price: number;
    }>;
    total: number;
  }): void {
    this.update({
      lastOrder: {
        ...order,
        date: new Date().toISOString(),
      },
    });
  },

  /**
   * Update dietary preference
   */
  saveDietaryPreference(dietary: 'vegetarian' | 'non-veg' | 'vegan'): void {
    const session = this.get();
    if (!session) return;

    const preferences = session.preferences || {};
    this.update({
      preferences: {
        ...preferences,
        dietary,
      },
    });
  },

  /**
   * Add category to favorites
   */
  addFavoriteCategory(category: string): void {
    const session = this.get();
    if (!session) return;

    const preferences = session.preferences || {};
    const favoriteCategories = preferences.favoriteCategories || [];

    if (!favoriteCategories.includes(category)) {
      favoriteCategories.push(category);
    }

    this.update({
      preferences: {
        ...preferences,
        favoriteCategories,
      },
    });
  },

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
};

/**
 * React hook for using session cookie in components
 */
export function useSession() {
  if (typeof window === 'undefined') {
    return {
      session: null,
      isReturning: false,
      createSession: () => {},
      updateSession: () => {},
      clearSession: () => {},
      saveOrder: () => {},
      saveDietary: () => {},
      addFavorite: () => {},
    };
  }

  return {
    session: SessionCookieManager.get(),
    isReturning: SessionCookieManager.isReturningUser(),
    createSession: SessionCookieManager.createNew,
    updateSession: SessionCookieManager.update,
    clearSession: SessionCookieManager.clear,
    saveOrder: SessionCookieManager.saveLastOrder,
    saveDietary: SessionCookieManager.saveDietaryPreference,
    addFavorite: SessionCookieManager.addFavoriteCategory,
  };
}
