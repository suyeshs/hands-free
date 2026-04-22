'use client';

import { useState, useRef, useEffect } from 'react';
import { VertexAILiveService } from '../services/VertexAILiveService';
import { DisplayWebSocketService } from '../services/DisplayWebSocket';
import { PartyKitService } from '../services/PartyKitService';
import { MultimodalDisplay } from './MultimodalDisplay';
import { Cart } from './Cart';
import { CartIsland } from './CartIsland';
import { CollaborativeOrderPanel } from './collaborative/CollaborativeOrderPanel';
import { OrderFlow } from './order/OrderFlow';
import { Toast, ToastMessage } from './Toast';
import Menu from './Menu';
import { menuStore } from '../stores/menuStore';
import { cartStore } from '../stores/cartStore';
import { orderStore } from '../stores/orderStore';
import { collaborativeOrderStore } from '../stores/collaborativeOrderStore';
import { observer } from 'mobx-react-lite';
import { useRestaurant } from '../contexts/RestaurantContext';
import { useTheme } from '../contexts/ThemeContext';
import GrabHeader from './grab-food/GrabHeader';
import PromoCarousel from './grab-food/PromoCarousel';
import CategoryPills from './grab-food/CategoryPills';
import GrabMenuItem from './grab-food/GrabMenuItem';
import { AddressSelectionDrawer } from './order/AddressSelectionDrawer';
import { API_URL, THEME_WORKER_URL } from '../config/api';

// Marketing Carousel Component with proper swipe and indicators
interface MarketingCarouselProps {
  items: any[];
}

function MarketingCarousel({ items }: MarketingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Update active index on scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const cardWidth = scrollRef.current.offsetWidth * 0.85; // 85% of container width
      const gap = 12; // gap-3 = 12px
      const index = Math.round(scrollLeft / (cardWidth + gap));
      setActiveIndex(Math.min(index, items.length - 1));
    }
  };

  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.offsetWidth * 0.85;
      const gap = 12;
      scrollRef.current.scrollTo({
        left: index * (cardWidth + gap),
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="w-full py-3 bg-[var(--color-bg-main,#faf8f5)]">
      {/* Carousel Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-3 snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {items.map((item: any, index: number) => (
          <div
            key={item.id || index}
            className="flex-shrink-0 snap-center"
            style={{ width: '92%', maxWidth: '480px' }}
          >
            <div
              className="relative rounded-2xl overflow-hidden shadow-xl"
              style={{
                minHeight: item.heroHeight || '220px',
                background: item.gradient
                  ? `linear-gradient(${item.gradient.direction === 'to-br' ? '135deg' : item.gradient.direction === 'to-r' ? '90deg' : '180deg'}, ${item.gradient.from}, ${item.gradient.to})`
                  : item.backgroundColor || 'linear-gradient(135deg, #78350f, #5c2a0e)',
              }}
            >
              {/* Background image if available */}
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}

              {/* Content */}
              <div className="relative h-full p-5 flex flex-col gap-3">
                {/* Badge */}
                {item.badge && (
                  <span
                    className="self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{
                      backgroundColor: item.badge.color || '#fbbf24',
                      color: item.badgeTextColor || '#78350f',
                    }}
                  >
                    {typeof item.badge === 'string' ? item.badge : item.badge.text}
                  </span>
                )}

                {/* Title, subtitle, description */}
                <div className="flex-1">
                  <h3
                    className="font-black leading-tight"
                    style={{
                      color: item.textColor || '#ffffff',
                      fontSize: 'clamp(1.35rem, 5vw, 1.75rem)',
                      fontFamily: '"Georgia", "Times New Roman", serif',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p
                      className="mt-1.5 font-semibold leading-snug"
                      style={{
                        color: item.textColor || '#ffffff',
                        fontSize: 'clamp(0.9rem, 3.5vw, 1.1rem)',
                        opacity: 0.92,
                      }}
                    >
                      {item.subtitle}
                    </p>
                  )}
                  {item.description && (
                    <p
                      className="mt-1 leading-snug"
                      style={{
                        color: item.textColor || '#ffffff',
                        fontSize: 'clamp(0.8rem, 3vw, 0.95rem)',
                        opacity: 0.75,
                      }}
                    >
                      {item.description}
                    </p>
                  )}
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-wrap gap-2">
                  {(item.ctaText || item.action?.label) && (
                    <a
                      href={
                        item.action?.type === 'link'
                          ? item.action.target
                          : undefined
                      }
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold no-underline transition-transform hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: item.accentColor || item.textColor || '#ffffff',
                        color: item.gradient?.from || item.backgroundColor || '#78350f',
                        fontSize: 'clamp(0.85rem, 3.5vw, 1rem)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      }}
                    >
                      {item.ctaText || item.action?.label}
                    </a>
                  )}
                  {item.secondaryAction?.label && (
                    <a
                      href={item.secondaryAction.target}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold no-underline transition-transform hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: item.secondaryAction.backgroundColor || 'rgba(255,255,255,0.18)',
                        color: item.secondaryAction.textColor || item.textColor || '#ffffff',
                        fontSize: 'clamp(0.85rem, 3.5vw, 1rem)',
                        border: `1.5px solid ${item.secondaryAction.borderColor || 'rgba(255,255,255,0.45)'}`,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {item.secondaryAction.label}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dot Indicators */}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-6 bg-[var(--color-primary-600,#78350f)]'
                  : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RestaurantOrderingAppProps {
  themeConfig?: any;
  isGrabFoodTheme?: boolean;
  menuItems?: any[];
}

const RestaurantOrderingApp = observer(function RestaurantOrderingApp({
  themeConfig,
  isGrabFoodTheme = false,
  menuItems = []
}: RestaurantOrderingAppProps) {
  // Restaurant config
  const { profile: restaurantProfile } = useRestaurant();
  const { theme } = useTheme();
  const restaurantName = restaurantProfile?.name || 'Restaurant';

  // Get logo from theme meta or restaurant profile (theme takes precedence as it's more dynamic)
  const logoUrl = theme?.meta?.logo || (theme as any)?.logo || restaurantProfile?.brandIdentity?.logo;

  // Get marketing carousel items from theme - check marketingCarousel component or promoCarousel items
  const marketingCarouselItems = theme?.components?.marketingCarousel?.items ||
    theme?.components?.promoCarousel?.items ||
    (theme as any)?.marketingCarousel ||
    [];

  // Grab-food theme state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg'>('all');

  // Session state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isConnecting, setIsConnecting] = useState(false); // Connection in progress
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Display state
  const [displayService, setDisplayService] = useState<DisplayWebSocketService | null>(null);
  const [currentDisplay, setCurrentDisplay] = useState<any>(null);
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  const displayLockRef = useRef<boolean>(false); // Prevents rapid display clearing
  const criticalDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const lastScrollY = useRef(0);
  const cartAutoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Collaborative order state
  const [showCollaborativeOrder, setShowCollaborativeOrder] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Address selection drawer state
  const [showAddressDrawer, setShowAddressDrawer] = useState(false);

  // Nav menu state
  const [showNavMenu, setShowNavMenu] = useState(false);

  // Load customer phone from localStorage on mount (returning customer)
  useEffect(() => {
    // Only access localStorage on the client
    if (typeof window !== 'undefined') {
      const savedPhone = localStorage.getItem('handsfree_customer_phone');
      if (savedPhone) {
        setCustomerPhone(savedPhone);
        console.log('[App] Loaded returning customer phone:', savedPhone);
      }
    }
  }, []);

  // Save customer phone to localStorage when it changes
  useEffect(() => {
    // Only access localStorage on the client
    if (typeof window !== 'undefined' && customerPhone) {
      localStorage.setItem('handsfree_customer_phone', customerPhone);
      console.log('[App] Saved customer phone to localStorage:', customerPhone);
    }
  }, [customerPhone]);

  // Voice session is created on-demand when user initiates voice ordering
  // Pre-connection is disabled to avoid unnecessary WebSocket overhead on page load

  // Audio visualization
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(0));
  const [conversationTime, setConversationTime] = useState(0);

  // Pre-connection state for instant voice ordering
  const [isPreconnected, setIsPreconnected] = useState(false);
  const preconnectedSessionRef = useRef<any>(null);

  // Refs for voice service
  const vertexAILiveServiceRef = useRef<VertexAILiveService | null>(null);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lastSpeechStartRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const idleAnimationRef = useRef<number | null>(null);
  const conversationStartTimeRef = useRef<number>(0);

  // PartyKit ref
  const partykitServiceRef = useRef<PartyKitService | null>(null);


  // Conversation timer
  useEffect(() => {
    if (isSessionActive) {
      conversationStartTimeRef.current = Date.now();
      setConversationTime(0);

      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - conversationStartTimeRef.current) / 1000);
        setConversationTime(elapsed);
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setConversationTime(0);
      conversationStartTimeRef.current = 0;
    }
  }, [isSessionActive]);


  // Auto-hide header on scroll
  useEffect(() => {
    if (!isSessionActive || typeof window === 'undefined') return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const currentScrollY = target.scrollTop;

      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show header
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    const mainElement = document.querySelector('main');
    mainElement?.addEventListener('scroll', handleScroll);

    return () => {
      mainElement?.removeEventListener('scroll', handleScroll);
    };
  }, [isSessionActive]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to show cart with auto-hide
  const showCartWithAutoHide = (duration: number = 8000) => {
    // Clear any existing timer
    if (cartAutoHideTimerRef.current) {
      clearTimeout(cartAutoHideTimerRef.current);
    }

    // Show cart
    setShowCart(true);

    // Set new auto-hide timer
    cartAutoHideTimerRef.current = setTimeout(() => {
      setShowCart(false);
      cartAutoHideTimerRef.current = null;
    }, duration);
  };

  // Helper to keep cart open (cancel auto-hide)
  const keepCartOpen = () => {
    if (cartAutoHideTimerRef.current) {
      clearTimeout(cartAutoHideTimerRef.current);
      cartAutoHideTimerRef.current = null;
    }
    setShowCart(true);
  };

  // Toast notifications
  const showToast = (message: string, type: ToastMessage['type'] = 'info', duration?: number) => {
    const id = Date.now().toString();
    const toast: ToastMessage = { id, message, type, duration };
    setToasts((prev) => [...prev, toast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // PartyKit Connection
  const connectToPartyKit = async (roomUrl: string, orderData: any) => {
    try {
      console.log('[PartyKit] Connecting to room:', roomUrl);

      const service = new PartyKitService();
      partykitServiceRef.current = service;

      const tenantId = orderData.tenantId || sessionInfo?.tenantId || 'default';
      const customerId = `${tenantId}_${customerPhone}`;

      // Setup callbacks before connecting
      service.onSync((state) => {
        console.log('[PartyKit] Synced state:', state);
        showToast('Connected to group order', 'success');
      });

      service.onParticipantJoined((participant) => {
        const isMe = participant.id === customerId;
        if (!isMe) {
          showToast(`${participant.name} joined the order`, 'participant');
        }
      });

      service.onParticipantLeft((participant) => {
        showToast(`${participant.name} left`, 'info');
      });

      service.onItemAdded((item, participant) => {
        const isMe = participant.id === customerId;
        if (!isMe) {
          showToast(`${participant.name} added ${item.dishName}`, 'info');
        }
      });

      service.onItemRemoved((itemId, participant) => {
        const isMe = participant.id === customerId;
        if (!isMe) {
          showToast(`${participant.name} removed an item`, 'info');
        }
      });

      service.onOrderFinalized(() => {
        showToast('Order has been finalized!', 'success', 6000);
      });

      service.onError((error) => {
        console.error('[PartyKit] Error:', error);
        showToast('Connection error. Reconnecting...', 'error');
      });

      // Connect to PartyKit
      await service.connect(
        roomUrl,
        customerId,
        customerName || 'Guest',
        orderData.circleId,
        tenantId,
        customerPhone
      );

      // Setup store
      collaborativeOrderStore.setRoomData({
        roomId: orderData.id || orderData.sessionId,
        circleId: orderData.circleId,
        circleName: orderData.circleName || 'Group Order',
        currentUserId: customerId
      });

      // Open collaborative order panel
      setShowCollaborativeOrder(true);

      console.log('[PartyKit] Connected successfully');
    } catch (error) {
      console.error('[PartyKit] Connection failed:', error);
      showToast('Failed to connect to group order', 'error');
    }
  };

  const disconnectFromPartyKit = () => {
    if (partykitServiceRef.current) {
      partykitServiceRef.current.disconnect();
      partykitServiceRef.current = null;
    }
    setShowCollaborativeOrder(false);
  };

  // Handle manual order flow
  const handlePlaceOrder = () => {
    if (cartStore.items.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }
    setShowCart(false);
    setShowOrderFlow(true);
  };

  const handleOrderFlowClose = () => {
    setShowOrderFlow(false);
  };

  // Idle animation
  // Helper: Convert Float32 to PCM16
  const convertFloat32ToPCM16 = (float32Data: Float32Array): ArrayBuffer => {
    const pcmData = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcmData.buffer;
  };

  const startIdleAnimation = () => {
    if (idleAnimationRef.current) return;

    let time = 0;
    const animate = () => {
      time += 0.05;
      const newLevels = Array.from({ length: 32 }, (_, i) => {
        const wave1 = Math.sin(time + i * 0.5) * 0.15;
        const wave2 = Math.sin(time * 1.3 - i * 0.3) * 0.1;
        return Math.abs(wave1 + wave2);
      });
      setAudioLevels(newLevels);
      idleAnimationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const stopIdleAnimation = () => {
    if (idleAnimationRef.current) {
      cancelAnimationFrame(idleAnimationRef.current);
      idleAnimationRef.current = null;
    }
  };

  const startSession = async () => {
    try {
      console.log('[Restaurant] Starting session...');

      // INSTANT FEEDBACK: Show orbs immediately before any async operations
      setIsConnecting(true); // Mark as connecting
      setSessionStatus('listening');
      setIsSessionActive(true);
      startIdleAnimation();

      // Check if we have a pre-connected session for instant start
      if (isPreconnected && vertexAILiveServiceRef.current && preconnectedSessionRef.current) {
        console.log('[Restaurant] ⚡ Using pre-connected session - instant start!');

        // Request microphone permission (only async operation left)
        await startContinuousMicrophoneCapture();
        console.log('[Restaurant] Microphone access granted');

        // Use pre-connected session data
        setSessionInfo(preconnectedSessionRef.current);

        // Connect cartStore to voice service
        cartStore.setVoiceService(vertexAILiveServiceRef.current);

        // Initialize display service
        const apiUrl = API_URL;
        const workerUrl = THEME_WORKER_URL;
        const tenantId = restaurantProfile?.tenantId || 'demo-restaurant';

        const service = new DisplayWebSocketService({
          tenantId: tenantId,
          category: 'restaurant',
          wsUrl: workerUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/conversation/display'
        });
        setDisplayService(service);

        await service.connect(preconnectedSessionRef.current.sessionId);
        console.log('[Restaurant] Connected to display service');

        // Set up display handlers
        service.on('*', (update: any) => {
          console.log('[Restaurant] Display update:', update.type, update);

          if (update.type === 'transcription') {
            setTranscriptions((prev) => [...prev, update]);

            const text = update.data?.text?.toLowerCase() || '';
            const cartRelatedPhrases = ['cart', 'order', 'what did i', 'what have i', 'show me', 'whats in'];
            const continueOrderingPhrases = ['add', 'also', 'and', 'want', 'get me', 'ill have', 'i need'];

            if (cartRelatedPhrases.some(phrase => text.includes(phrase))) {
              keepCartOpen();
            } else if (continueOrderingPhrases.some(phrase => text.includes(phrase)) && cartStore.itemCount > 0) {
              showCartWithAutoHide(12000);
            }
          } else if (update.type === 'customer_update') {
            console.log('[Restaurant] Customer update from backend:', update.customer);
            if (update.customer) {
              orderStore.setCustomer({
                name: update.customer.name,
                phone: update.customer.phone,
                email: update.customer.email || undefined
              });
              if (update.customer.phone) {
                setCustomerPhone(update.customer.phone);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('handsfree_customer_phone', update.customer.phone);
                }
              }
            }
          } else {
            // Handle all other display updates
            setCurrentDisplay(update);

            if (update.displayType === 'order_summary' || update.displayType === 'confirmation') {
              showCartWithAutoHide(15000);
            } else if (update.displayType === 'dish_card') {
              showCartWithAutoHide(10000);
            }
          }
        });

        setIsConnecting(false);
        console.log('[Restaurant] ✅ Voice ordering started instantly!');
        return;
      }

      // Fallback: If no pre-connection, use original flow
      console.log('[Restaurant] Pre-connection not available, creating session now...');

      // Request microphone permission
      console.log('[Restaurant] Requesting microphone permission...');
      await startContinuousMicrophoneCapture();
      console.log('[Restaurant] Microphone access granted');

      // Create session with backend (Cloud Run)
      const apiUrl = API_URL;
      const workerUrl = THEME_WORKER_URL;

      console.log('[Restaurant] Creating backend session...');
      const tenantId = restaurantProfile?.tenantId || 'demo-restaurant';
      console.log('[Restaurant] Using tenant ID:', tenantId);

      const response = await fetch(`${apiUrl}/api/restaurant/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId: 'demo-user',
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json() as any;
      console.log('[Restaurant] Session created:', data);
      setSessionInfo(data);

      // Initialize Vertex AI Live service
      let wsUrl = `${apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')}${data.websocketUrl}`;

      // Add tenantId to WebSocket URL (critical for loading tenant-specific voice config)
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl += `${separator}tenantId=${encodeURIComponent(tenantId)}`;
      console.log('[Restaurant] Adding tenantId to WebSocket URL:', tenantId);

      // Add customerPhone to URL if available (for returning customers)
      if (customerPhone) {
        wsUrl += `&customerPhone=${encodeURIComponent(customerPhone)}`;
        console.log('[Restaurant] Adding returning customer phone to WebSocket URL');
      }

      vertexAILiveServiceRef.current = new VertexAILiveService(wsUrl);

      // Set up audio playback callback
      vertexAILiveServiceRef.current.onAudio(async (audioData: ArrayBuffer) => {
        console.log('[Restaurant] Audio response received');
        await playPCMAudio(audioData);
      });

      // Set up message callback
      vertexAILiveServiceRef.current.onMessage((message: any) => {
        console.log('[Restaurant] Message:', message.type);
        if (message.type === 'session_ready') {
          setSessionStatus('listening');
        } else if (message.type === 'session_reconnecting') {
          console.log('[Restaurant] Session reconnecting...');
          setSessionStatus('thinking');
          showToast('Reconnecting session...', 'info');
        } else if (message.type === 'session_reconnect_failed') {
          console.error('[Restaurant] Session reconnection failed');
          setSessionStatus('idle');
          showToast('Session expired. Please start a new conversation.', 'error');

          // CRITICAL: End the session to stop the audio loop
          endSession();
        } else if (message.type === 'manual_cart_ack') {
          // Acknowledgment from backend for manual cart sync
          console.log('[Restaurant] Manual cart sync acknowledged:', {
            success: message.success,
            action: message.action,
            item: message.item,
            error: message.error
          });
          if (!message.success) {
            console.warn('[Restaurant] Manual cart sync failed:', message.error);
          }
        } else if (message.type === 'error') {
          console.error('[Restaurant] Error:', message.message);
          showToast(message.message || 'An error occurred', 'error');
        }
      });

      // Connect to Vertex AI Live
      await vertexAILiveServiceRef.current.connect('en');
      console.log('[Restaurant] Connected to Vertex AI Live');

      // Connect cartStore to voice service for bi-directional cart sync
      cartStore.setVoiceService(vertexAILiveServiceRef.current);

      // Initialize display service with proper config
      const service = new DisplayWebSocketService({
        tenantId: tenantId,
        category: 'restaurant',
        wsUrl: workerUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/conversation/display'
      });
      setDisplayService(service);

      // Connect to display WebSocket
      await service.connect(data.sessionId);
      console.log('[Restaurant] Connected to display service');

      // Handle all display updates via wildcard listener
      service.on('*', (update: any) => {
        console.log('[Restaurant] Display update:', update.type, update);

        if (update.type === 'transcription') {
          setTranscriptions((prev) => [...prev, update]);

          // Check if user is asking about cart or wanting to continue ordering
          const text = update.data?.text?.toLowerCase() || '';
          const cartRelatedPhrases = ['cart', 'order', 'what did i', 'what have i', 'show me', 'whats in'];
          const continueOrderingPhrases = ['add', 'also', 'and', 'want', 'get me', 'ill have', 'i need'];

          if (cartRelatedPhrases.some(phrase => text.includes(phrase))) {
            // User is asking about cart - keep it open indefinitely
            keepCartOpen();
          } else if (continueOrderingPhrases.some(phrase => text.includes(phrase)) && cartStore.itemCount > 0) {
            // User is adding more items - keep cart visible but with auto-hide
            showCartWithAutoHide(12000); // 12 seconds for multi-item ordering
          }
        } else if (update.type === 'customer_update') {
          // SINGLE SOURCE OF TRUTH: Backend broadcasts customer data
          console.log('[Restaurant] Customer update from backend:', update.customer);
          if (update.customer) {
            orderStore.setCustomer({
              name: update.customer.name,
              phone: update.customer.phone,
              email: update.customer.email || undefined
            });
            // Persist phone for returning customer detection
            if (update.customer.phone) {
              setCustomerPhone(update.customer.phone);
              if (typeof window !== 'undefined') {
                localStorage.setItem('handsfree_customer_phone', update.customer.phone);
              }
            }
          }
        } else if (update.type === 'customer_addresses') {
          // OPTIMIZATION: Backend sends saved addresses via WebSocket
          // This eliminates the need for HTTP request in AddressEntry component
          console.log('[Restaurant] Customer addresses from backend:', update.addresses?.length || 0);
          if (update.addresses && update.addresses.length > 0 && typeof window !== 'undefined') {
            // Store addresses in sessionStorage for AddressEntry to pick up
            sessionStorage.setItem('handsfree_saved_addresses', JSON.stringify(update.addresses));

            // QUICK CHECKOUT: Auto-populate default address in orderStore
            const defaultAddress = update.addresses.find((addr: any) => addr.isDefault);
            if (defaultAddress) {
              console.log('[Restaurant] Auto-populating default address for quick checkout');
              orderStore.setDeliveryAddress({
                formatted: defaultAddress.formatted,
                coordinates: defaultAddress.coordinates,
                placeId: defaultAddress.placeId,
                pincode: defaultAddress.pincode,
                city: defaultAddress.city,
                state: defaultAddress.state,
                apartment: defaultAddress.apartment,
                landmark: defaultAddress.landmark,
                instructions: defaultAddress.instructions,
              });
            }
          }
        } else {
          // Protected display update with minimum display duration for critical flows
          const isCriticalDisplay = ['checkout_summary', 'payment_pending', 'order_confirmed', 'address_verification', 'manual_address_form'].includes(update.type);

          // Clear any existing critical display timer
          if (criticalDisplayTimerRef.current) {
            clearTimeout(criticalDisplayTimerRef.current);
            criticalDisplayTimerRef.current = null;
          }

          // Update display
          setCurrentDisplay(update);

          // For critical displays, set a lock to prevent accidental clearing
          if (isCriticalDisplay) {
            displayLockRef.current = true;
            criticalDisplayTimerRef.current = setTimeout(() => {
              displayLockRef.current = false;
              criticalDisplayTimerRef.current = null;
            }, 2000); // Minimum 2 second display duration
          } else {
            displayLockRef.current = false;
          }

          // Highlight menu items when shown
          if (update.type === 'dish_card' || update.type === 'menu_item' || update.type === 'combo_item') {
            if (update.data?.name) {
              menuStore.highlightItem(update.data.name);
            }
          }

          // Handle cart updates from voice ordering
          if (update.type === 'cart_item_added' && update.data?.item) {
            const { dishName, quantity, choices } = update.data.item;
            console.log('[Restaurant] Adding item to cart:', dishName, quantity, choices);

            // Find the menu item to get full details
            const menuItem = menuItems.find(
              item => item.name.toLowerCase() === dishName.toLowerCase()
            );

            if (menuItem) {
              // Add multiple items based on quantity
              for (let i = 0; i < (quantity || 1); i++) {
                if ('choices' in menuItem) {
                  // It's a combo item - use the selected choice from the voice order
                  // The backend sends choices as an array, take the first one or use default
                  const selectedChoice = (choices && choices.length > 0) ? choices[0] : menuItem.choices[0];
                  console.log('[Restaurant] Adding combo with choice:', selectedChoice);
                  cartStore.addComboItem(menuItem, selectedChoice);
                } else {
                  cartStore.addMenuItem(menuItem);
                }
              }

              // Auto-show cart when item is added (8 seconds to review)
              showCartWithAutoHide(8000);
            }
          }

          // Handle cart updates from voice ordering (including removals)
          if (update.type === 'cart_updated' && update.data?.cart) {
            console.log('[Restaurant] Cart updated from voice:', {
              action: update.data.action,
              source: update.data.source
            });

            // Use smart reconciliation instead of clearing and rebuilding
            // This prevents sync loops and preserves in-flight changes
            cartStore.reconcileWithBackend(update.data.cart, update.data.source);

            // Show cart for modifications and additions
            // Keep cart open longer when removing (10s) so user can see what's left
            // Shorter for additions (8s) to not interrupt ordering flow
            if (update.data.action === 'remove') {
              showCartWithAutoHide(10000); // 10 seconds after removal
            } else if (update.data.action === 'decrease') {
              showCartWithAutoHide(8000); // 8 seconds after quantity decrease
            } else if (update.data.action === 'increase') {
              showCartWithAutoHide(6000); // 6 seconds after quantity increase
            }

            // Sync to PartyKit if in collaborative mode
            if (collaborativeOrderStore.roomId && partykitServiceRef.current && update.data.action === 'add') {
              const addedItem = update.data.cart.items[update.data.cart.items.length - 1];
              if (addedItem) {
                partykitServiceRef.current.sendAddItem({
                  dishName: addedItem.dishName,
                  dishType: addedItem.dishType,
                  quantity: addedItem.quantity,
                  price: addedItem.price,
                  customization: addedItem.customization
                });
              }
            }
          }

          // Handle customer info capture
          if (update.type === 'customer_info_captured' && update.data?.customer) {
            setCustomerName(update.data.customer.name);
            setCustomerPhone(update.data.customer.phone);
            showToast(`Welcome, ${update.data.customer.name}!`, 'success');
          }

          // Handle circle created
          if (update.type === 'circle_created' && update.data?.circle) {
            showToast(`Circle "${update.data.circle.name}" created`, 'success');
          }

          // Handle member invited
          if (update.type === 'member_invited' && update.data) {
            showToast(`${update.data.inviteeName} added to circle`, 'success');
          }

          // Handle collaborative order started
          if (update.type === 'collaborative_order_started' && update.data) {
            const { partykitRoomUrl, collaborativeOrder } = update.data;
            if (partykitRoomUrl && collaborativeOrder) {
              connectToPartyKit(partykitRoomUrl, collaborativeOrder);
            }
          }

          // Handle collaborative order finalized
          if (update.type === 'collaborative_order_finalized') {
            collaborativeOrderStore.finalize();
            showToast('Order finalized! Proceeding to payment...', 'success', 6000);
          }
        }
      });

      service.on('error', (error: any) => {
        console.error('[Display service error:', error);
      });

      // Mark connection as complete
      setIsConnecting(false);
      console.log('[Restaurant] Session started successfully');
    } catch (error: any) {
      console.error('[Restaurant] Failed:', error);
      setError(error.message);
      setSessionStatus('idle');
      setIsSessionActive(false);
      setIsConnecting(false); // Reset connecting state
      stopIdleAnimation(); // Stop animation on error
    }
  };

  const startContinuousMicrophoneCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    recordingContextRef.current = audioContext;

    // Load AudioWorklet processor
    await audioContext.audioWorklet.addModule('/audio-processor.js');

    const source = audioContext.createMediaStreamSource(stream);

    // Create frequency filtering nodes for speech band (300Hz-3400Hz)
    // This helps isolate voice and reduce background noise

    // High-pass filter: Remove low-frequency rumble below 300Hz
    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 300; // Cut off below 300Hz
    highPassFilter.Q.value = 0.7; // Moderate resonance

    // Low-pass filter: Remove high-frequency noise above 3400Hz
    const lowPassFilter = audioContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 3400; // Cut off above 3400Hz
    lowPassFilter.Q.value = 0.7; // Moderate resonance

    // Optional: Peaking filter to boost speech clarity (1000-2000Hz range)
    const peakingFilter = audioContext.createBiquadFilter();
    peakingFilter.type = 'peaking';
    peakingFilter.frequency.value = 1500; // Center of speech clarity range
    peakingFilter.Q.value = 1.0; // Moderate bandwidth
    peakingFilter.gain.value = 3; // +3dB boost for clarity

    const workletNode = new AudioWorkletNode(audioContext, 'audio-stream-processor');

    // Handle messages from AudioWorklet
    workletNode.port.onmessage = async (event: any) => {
      const { type, data, rms, duration } = event.data;

      if (type === 'speech-start') {
        // INTERRUPTION DETECTION: User started speaking
        if (sessionStatus === 'speaking') {
          console.log('[Audio] INTERRUPTION - User spoke while AI was speaking');

          // Stop current audio playback immediately
          if (playbackContextRef.current) {
            playbackContextRef.current.close().catch(() => { });
            playbackContextRef.current = null;
          }

          // Clear visualization
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // Reset playback state
          nextPlayTimeRef.current = 0;
          isPlayingRef.current = false;

          // Send interruption signal to backend
          if (vertexAILiveServiceRef.current) {
            vertexAILiveServiceRef.current.interrupt();
          }
        }

        lastSpeechStartRef.current = performance.now();
        setSessionStatus('listening');
        stopIdleAnimation();
      } else if (type === 'calibration-started') {
        // Calibration started
      } else if (type === 'calibration-complete') {
        setSessionStatus('listening');
      } else if (type === 'calibration-progress') {
        // Calibration in progress
      } else if (type === 'noise-floor-updated') {
        // Noise floor updated
      } else if (type === 'audio-data') {
        // Send all audio directly to Vertex AI (no VAD filtering)
        if (!vertexAILiveServiceRef.current?.isActive()) {
          return;
        }

        // Don't send audio when OrderFlow is open (user is checking out)
        if (showOrderFlow) {
          return;
        }

        // Convert ArrayBuffer to Float32Array
        const float32Data = new Float32Array(data);

        // Convert to PCM16 and send to Gemini (no VAD filtering)
        const pcmData = convertFloat32ToPCM16(float32Data);

        if (vertexAILiveServiceRef.current.isActive()) {
          vertexAILiveServiceRef.current.sendAudio(pcmData);
        }

        // Set status to listening when audio is being sent
        if (sessionStatus === 'idle') {
          setSessionStatus('listening');
          stopIdleAnimation();
        }
      }
    };

    // Connect audio pipeline with frequency filtering
    // source -> highpass -> lowpass -> peaking -> worklet (processes and sends to backend)
    // NOTE: Do NOT connect worklet to destination - that creates audio feedback loop!
    source.connect(highPassFilter);
    highPassFilter.connect(lowPassFilter);
    lowPassFilter.connect(peakingFilter);
    peakingFilter.connect(workletNode);
    // workletNode does NOT connect to destination - only processes audio

    // Start noise floor calibration (2 seconds)
    workletNode.port.postMessage({ type: 'startCalibration' });

    setSessionStatus('listening');
  };

  const startAudioVisualization = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualization = () => {
      analyser.getByteFrequencyData(dataArray);

      const barCount = 32;
      const barWidth = Math.floor(bufferLength / barCount);
      const newLevels: number[] = [];

      for (let i = 0; i < barCount; i++) {
        const start = i * barWidth;
        const end = start + barWidth;
        let sum = 0;

        for (let j = start; j < end; j++) {
          sum += dataArray[j];
        }

        const average = sum / barWidth;
        const normalized = Math.min((average / 255) * 3.0, 1);
        newLevels.push(normalized);
      }

      setAudioLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  };

  const playPCMAudio = async (audioData: ArrayBuffer) => {
    try {
      // Initialize playback audio context if needed
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;

        // Create analyser for visualization
        analyserRef.current = playbackContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.connect(playbackContextRef.current.destination);
      }

      const audioContext = playbackContextRef.current;

      // Resume AudioContext if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const pcm16 = new Int16Array(audioData);

      // Convert Int16 PCM to Float32
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      // Schedule audio chunk
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to analyser for visualization
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(audioContext.destination);
      }

      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);

      const duration = audioBuffer.duration;
      nextPlayTimeRef.current = startTime + duration;

      // Update UI on first chunk
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setSessionStatus('speaking');
        startAudioVisualization();
      }

      // Detect end of playback
      const timeUntilEnd = (startTime + duration - audioContext.currentTime) * 1000 + 200;
      setTimeout(() => {
        if (audioContext.currentTime >= nextPlayTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          setSessionStatus('listening');

          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          startIdleAnimation();
        }
      }, Math.max(timeUntilEnd, 0));
    } catch (error) {
      console.error('[Restaurant] Audio playback error:', error);
    }
  };

  /**
   * Handle user actions from display (button clicks)
   */
  const handleDisplayAction = (action: string, data: any) => {
    console.log('[Restaurant] Display action:', action, data);

    if (displayService) {
      displayService.sendAction(action, data);
    } else {
      console.error('[Restaurant] Display service not available');
    }
  };

  const endSession = async () => {
    // Clear cart auto-hide timer
    if (cartAutoHideTimerRef.current) {
      clearTimeout(cartAutoHideTimerRef.current);
      cartAutoHideTimerRef.current = null;
    }

    // Stop all animations
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopIdleAnimation();

    // Disconnect services
    if (vertexAILiveServiceRef.current) {
      vertexAILiveServiceRef.current.disconnect();
      vertexAILiveServiceRef.current = null;
      // Disconnect cartStore from voice service
      cartStore.setVoiceService(null);
    }

    // Reset pre-connection state
    setIsPreconnected(false);
    preconnectedSessionRef.current = null;

    if (displayService) {
      displayService.disconnect();
      setDisplayService(null);
    }

    // Disconnect PartyKit
    disconnectFromPartyKit();

    // Close audio contexts
    if (recordingContextRef.current) {
      await recordingContextRef.current.close();
      recordingContextRef.current = null;
    }

    if (playbackContextRef.current) {
      await playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    analyserRef.current = null;
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
    setIsSessionActive(false);
    setSessionStatus('idle');
    setAudioLevels(new Array(32).fill(0));
    setTranscriptions([]);
    setCurrentDisplay(null);
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#f8f9fa] to-[#0a0a0a]">
        <div className="max-w-md w-full mx-4 p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h3 className="text-lg font-bold mb-2 text-red-400">Error</h3>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Filter menu items for grab-food theme
  const filteredMenuItems = isGrabFoodTheme
    ? menuItems.filter(item => {
      const categoryMatch = selectedCategory === 'All' ||
        item.category === selectedCategory ||
        item.tier1Category === selectedCategory;
      const vegMatch = vegFilter === 'all' ||
        (vegFilter === 'veg' && (item.dietaryInfo?.isVeg === true || item.vegNonVeg?.toLowerCase() === 'veg'));
      return categoryMatch && vegMatch;
    })
    : menuItems;

  // Extract unique categories for grab-food theme
  const categories = isGrabFoodTheme
    ? ['All', ...new Set(menuItems.map(item => item.tier1Category || item.category).filter(Boolean))]
    : [];

  return (
    <div className={`h-screen flex flex-col ${isGrabFoodTheme ? '' : 'neu-bg'}`}>
      {!isSessionActive ? (
        /* Landing Screen - Menu Display */
        <>
          {isGrabFoodTheme ? (
            /* Grab-Food Theme Layout */
            <div className="grab-container">
              <GrabHeader onAddressClick={() => setShowAddressDrawer(true)} />
              <PromoCarousel />
              <CategoryPills
                categories={categories as string[]}
                selected={selectedCategory}
                onSelectCategory={setSelectedCategory}
                vegFilter={vegFilter}
                onVegFilterChange={setVegFilter}
              />
              <div className="section-header">
                <div className="section-title">Popular Items</div>
                <div className="view-all">View All →</div>
              </div>
              <div className="menu-items">
                {filteredMenuItems.map(item => (
                  <GrabMenuItem
                    key={item.name || item.serialNumber}
                    item={{
                      itemId: item.name || item.serialNumber,
                      name: item.name,
                      price: item.price,
                      description: item.description || item.aiDescription,
                      imageUrl: item.imageUrl,
                      isVegetarian: item.dietaryInfo?.isVeg === true || item.vegNonVeg?.toLowerCase() === 'veg',
                      isVegan: item.dietaryInfo?.isVegan === true,
                      choices: item.choices
                    }}
                  />
                ))}
              </div>
              {/* Hamburger menu button for grab-food theme */}
              <button
                onClick={() => setShowNavMenu(true)}
                className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition-colors"
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {/* Voice FAB for grab-food theme */}
              <div className="voice-fab" onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startSession();
              }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: '28px', height: '28px', opacity: 0.9 }}
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                  <path d="M16 7s1 1 1 2" opacity="0.6" />
                  <path d="M18 6s2 1 2 3" opacity="0.6" />
                  <path d="M20 5s3 2 3 5" opacity="0.6" />
                </svg>
              </div>
              {/* Cart pill shows when items added */}
              {cartStore.itemCount > 0 && (
                <div className="cart-pill" onClick={() => setShowCart(true)}>
                  <span className="cart-icon">🛒</span>
                  <span className="cart-count">{cartStore.itemCount}</span>
                  <span className="cart-total">₹{cartStore.total}</span>
                </div>
              )}
            </div>
          ) : (
            /* Neumorphic Theme Layout (Default) */
            <>
              {/* Header - sticky at top */}
              <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center overflow-hidden bg-white shadow-md p-1.5">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`${restaurantName} logo`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl md:text-3xl">🍽️</span>
                      )}
                    </div>
                    <h1 className="text-lg md:text-xl font-bold text-gray-900">{restaurantName}</h1>
                    <div className="ml-auto">
                      <button
                        onClick={() => setShowNavMenu(true)}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        aria-label="Open menu"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <line x1="3" y1="12" x2="21" y2="12" />
                          <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </header>

              {/* Marketing Carousel - scrolls away with content */}
              {marketingCarouselItems.length > 0 && (
                <MarketingCarousel items={marketingCarouselItems} />
              )}

              {/* Menu Display */}
              <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-4">
                <div className="max-w-7xl mx-auto">
                  <Menu />
                </div>
              </main>

              {/* Cart Island for browsing mode */}
              <CartIsland onClick={() => setShowCart(true)} />

              {/* Voice Order FAB - Pulsating Orb */}
              <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-3">
                <button
                  onClick={startSession}
                  className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 group"
                  aria-label="Start voice conversation"
                >
                  {/* Outer Glow Ring - Pulsating */}
                  <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />

                  {/* Middle Glow Ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 opacity-80 blur-md group-hover:blur-lg transition-all" />

                  {/* Inner Orb */}
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
                  </div>
                </button>

                {/* Label */}
                <span className="text-sm font-semibold neu-text">
                  Start Voice Order
                </span>
              </div>
            </>
          )}

          {/* Nav Menu Drawer - shared between themes */}
          {showNavMenu && (() => {
            const tenantId = restaurantProfile?.tenantId || 'default';
            const legalBase = THEME_WORKER_URL;
            const links = [
              { label: 'Privacy Policy',      href: `${legalBase}/ui/privacy?tenant=${tenantId}` },
              { label: 'Terms & Conditions',  href: `${legalBase}/ui/terms?tenant=${tenantId}` },
              { label: 'Cookie Policy',       href: `${legalBase}/ui/cookies?tenant=${tenantId}` },
            ];
            return (
              <div
                className="fixed inset-0 z-[3000] flex justify-end"
                onClick={() => setShowNavMenu(false)}
              >
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div
                  className="relative w-72 h-full bg-white shadow-2xl flex flex-col"
                  style={{ animation: 'slideInFromRight 0.3s cubic-bezier(0.16,1,0.3,1)' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Drawer header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <span className="font-semibold text-gray-800">{restaurantName}</span>
                    <button
                      onClick={() => setShowNavMenu(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Nav links */}
                  <nav className="flex-1 px-4 py-6 space-y-1">
                    {links.map(link => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors text-sm font-medium"
                        onClick={() => setShowNavMenu(false)}
                      >
                        {link.label}
                        <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    ))}
                  </nav>

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-gray-100 text-xs text-gray-400">
                    Powered by HandsFree.tech
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Order Panel - Slide-in from Right (shared between themes) */}
          {showCart && (
            <div
              className="fixed inset-0 z-[2000] flex"
              onClick={() => setShowCart(false)}
            >
              {/* Backdrop with blur */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

              {/* Slide-in Panel */}
              <div className="ml-auto relative w-full max-w-md h-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <Cart onPlaceOrder={handlePlaceOrder} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* Active Session - Voice-First Layout */
        <>
          {/* Auto-hiding Glassmorphic Header */}
          <header className={`fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
            }`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center overflow-hidden bg-white/50 backdrop-blur-sm shadow-md p-2">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${restaurantName} logo`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl md:text-3xl">🍽️</span>
                    )}
                  </div>
                  <h1 className="text-lg md:text-xl font-bold text-gray-900">{restaurantName}</h1>
                </div>

                {/* Voice Status Indicator */}
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-white/60 backdrop-blur-sm px-3 py-2 md:px-4 md:py-2 rounded-full flex items-center gap-2 shadow-sm border border-white/30">
                    <div className={`w-2 h-2 rounded-full ${sessionStatus === 'listening' ? 'bg-blue-500 animate-pulse' :
                      sessionStatus === 'thinking' ? 'bg-yellow-500 animate-pulse' :
                        sessionStatus === 'speaking' ? 'bg-green-500 animate-pulse' :
                          'bg-gray-400'
                      }`} />
                    <span className="text-xs font-medium text-gray-700 capitalize hidden md:inline">{sessionStatus}</span>
                  </div>
                  <button
                    onClick={endSession}
                    className="bg-red-50/80 backdrop-blur-sm text-xs px-3 py-2 md:px-4 md:py-2 rounded-lg font-medium text-red-600 hover:bg-red-100/80 transition-colors shadow-sm border border-red-200/50"
                  >
                    <span className="hidden md:inline">End Session</span>
                    <span className="md:hidden">End</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6 pb-32">
            <div className="max-w-7xl mx-auto">
              {/* Full Menu Display */}
              <Menu />

              {/* Voice-triggered Dish Card Modal */}
              {currentDisplay && (currentDisplay.type === 'dish_card' || currentDisplay.type === 'menu_item' || currentDisplay.type === 'combo_item') && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-fade-in">
                  <div
                    className="max-w-md w-full animate-scale-in"
                  >
                    <MultimodalDisplay
                      visualData={currentDisplay}
                      onAction={handleDisplayAction}
                    />
                  </div>
                </div>
              )}

              {/* Order/Payment Flow Modal - Non-dismissible to prevent accidental closure */}
              {currentDisplay && (
                currentDisplay.type === 'checkout_summary' ||
                currentDisplay.type === 'payment_pending' ||
                currentDisplay.type === 'order_confirmed' ||
                currentDisplay.type === 'address_verification' ||
                currentDisplay.type === 'manual_address_form'
              ) && (
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-fade-in">
                    <div className="max-w-md w-full h-full max-h-[90vh] animate-scale-in">
                      <MultimodalDisplay
                        visualData={currentDisplay}
                        onAction={handleDisplayAction}
                      />
                    </div>
                  </div>
                )}
            </div>
          </main>

          {/* Voice Mic FAB with Integrated Visualizer */}
          <div className={`neu-voice-mic ${sessionStatus === 'listening' ? 'animate-pulse' : ''}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Circular Audio Visualizer */}
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                style={{ willChange: 'transform' }}
              >
                {audioLevels.slice(0, 16).map((level, i) => {
                  const numBars = 16;
                  const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
                  const baseRadius = 25;
                  const barLength = 5 + level * 15;
                  const innerRadius = baseRadius;
                  const outerRadius = baseRadius + barLength;

                  const x1 = 50 + Math.cos(angle) * innerRadius;
                  const y1 = 50 + Math.sin(angle) * innerRadius;
                  const x2 = 50 + Math.cos(angle) * outerRadius;
                  const y2 = 50 + Math.sin(angle) * outerRadius;

                  const color = sessionStatus === 'thinking'
                    ? `rgba(255, 149, 0, ${0.4 + level * 0.6})`
                    : sessionStatus === 'speaking'
                      ? `rgba(34, 197, 94, ${0.4 + level * 0.6})`
                      : `rgba(59, 130, 246, ${0.4 + level * 0.6})`;

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{
                        filter: `drop-shadow(0 0 ${2 + level * 4}px ${color})`,
                        transition: 'all 75ms ease-out',
                      }}
                    />
                  );
                })}
              </svg>

              {/* Connection Loading Spinner Overlay */}
              {isConnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-full">
                  <svg className="animate-spin h-12 w-12" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>


          {/* Cart Island - Floating cart indicator */}
          <CartIsland onClick={() => setShowCart(true)} />

          {/* Order Panel - Slide-in from Right */}
          {showCart && (
            <div
              className="fixed inset-0 z-[2000] flex"
              onClick={() => setShowCart(false)}
            >
              {/* Backdrop with blur */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

              {/* Slide-in Panel */}
              <div className="ml-auto relative w-full max-w-md h-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <Cart onPlaceOrder={handlePlaceOrder} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Collaborative Order Panel */}
      <CollaborativeOrderPanel
        isOpen={showCollaborativeOrder}
        onClose={() => {
          disconnectFromPartyKit();
          showToast('Left group order', 'info');
        }}
      />

      {/* Order Flow Panel */}
      <OrderFlow
        isOpen={showOrderFlow}
        onClose={handleOrderFlowClose}
        sessionId={sessionInfo?.sessionId}
        backendUrl={process.env.NEXT_PUBLIC_API_URL || 'https://handsfree-domain-service-prod.suyesh.workers.dev'}
        tenantId={restaurantProfile?.tenantId || 'demo'}
      />

      {/* Address Selection Drawer */}
      <AddressSelectionDrawer
        isOpen={showAddressDrawer}
        onClose={() => setShowAddressDrawer(false)}
        backendUrl={process.env.NEXT_PUBLIC_API_URL || 'https://handsfree-domain-service-prod.suyesh.workers.dev'}
        sessionId={sessionInfo?.sessionId || `browse-${Date.now()}`}
        tenantId={restaurantProfile?.tenantId || 'khao-piyo-7766'}
      />

    </div>
  );
});

export default RestaurantOrderingApp;
