/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import { WardrobeItem } from './types';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import GarmentDetailsModal from './components/GarmentDetailsModal';
import ShoppingCartModal from './components/ShoppingCartModal';
import Header from './components/Header';
import ProductDetailsPanel from './components/ProductDetailsPanel';
import { fetchCatalog } from './services/catalogService';
import {
  AuthSession,
  clearStoredAuthSession,
  getStoredAuthSession,
  storeAuthSession,
} from './services/authService';
import CollectionScreen from './src/screens/CollectionScreen';
import HFCViewer from './src/components/HFCViewer';

type AppState = 'start' | 'collection' | 'tryon';

const App: React.FC = () => {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const token = authSession?.token ?? null;
  const userEmail = authSession?.email ?? null;

  const [appState, setAppState] = useState<AppState>('start');
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentTryOnItem, setCurrentTryOnItem] = useState<WardrobeItem | null>(null);
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);

  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [cart, setCart] = useState<WardrobeItem[]>(() => {
    try {
      const saved = localStorage.getItem('closet.city.cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse cart from localStorage', e);
      return [];
    }
  });

  const [isGarmentModalOpen, setIsGarmentModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedGarmentForModal, setSelectedGarmentForModal] = useState<WardrobeItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('closet.city.cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  useEffect(() => {
    if (authSession) {
      storeAuthSession(authSession);
    } else {
      clearStoredAuthSession();
    }
  }, [authSession]);

  useEffect(() => {
    let isMounted = true;

    if (!token) {
      setWardrobe(defaultWardrobe);
      setCatalogError(null);
      setIsCatalogLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsCatalogLoading(true);
    setCatalogError(null);

    fetchCatalog(token)
      .then(items => {
        if (!isMounted) return;
        setWardrobe(items);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Failed to load catalog:', err);
        setWardrobe(defaultWardrobe);
        setCatalogError(getFriendlyErrorMessage(err, 'Failed to load catalog. Showing featured looks.'));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsCatalogLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAuthSuccess = (session: AuthSession) => {
    setAuthSession(session);
  };

  const handleLogout = () => {
    setAuthSession(null);
    setModelImageUrl(null);
    setCurrentTryOnItem(null);
    setOverlayImageUrl(null);
    setCart([]);
    setAppState('start');
  };

  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setOverlayImageUrl(null);
    setAppState('collection');
  };

  const handleBrowseAsGuest = () => {
    if (!token) {
      setError('Please sign in to explore the archive.');
      return;
    }
    setModelImageUrl(null);
    setOverlayImageUrl(null);
    setAppState('collection');
  };

  const handleBackToCollection = () => {
    setCurrentTryOnItem(null);
    setOverlayImageUrl(null);
    setError(null);
    setAppState('collection');
  };

  const handleStartOver = () => {
    setAppState('start');
    setModelImageUrl(null);
    setCurrentTryOnItem(null);
    setOverlayImageUrl(null);
    setError(null);
  };

  const handleAddToCart = (item: WardrobeItem) => {
    setCart(prevCart => {
      if (prevCart.some(cartItem => cartItem.id === item.id)) {
        return prevCart;
      }
      return [...prevCart, item];
    });
  };

  const handleBuyNow = (item: WardrobeItem) => {
    handleAddToCart(item);
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  useEffect(() => {
    if (!error) {
      return;
    }
    const timeout = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  const renderContent = () => {
    switch (appState) {
      case 'start':
        return (
          <StartScreen
            onModelFinalized={handleModelFinalized}
            onBrowseAsGuest={handleBrowseAsGuest}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            authToken={token}
            userEmail={userEmail}
          />
        );
      case 'collection':
        return (
          <CollectionScreen
            wardrobe={wardrobe}
            baseAvatarUrl={modelImageUrl}
            token={token}
            isCatalogLoading={isCatalogLoading}
            catalogError={catalogError}
            onOverlayReady={(item, overlayUrl) => {
              setError(null);
              setCurrentTryOnItem(item);
              setOverlayImageUrl(overlayUrl);
              setAppState('tryon');
            }}
            onOverlayError={message => {
              setError(message);
            }}
          />
        );
      case 'tryon':
        return (
          <div className="w-full h-full flex flex-col md:flex-row max-w-7xl mx-auto">
            <div className="w-full md:w-[60%] lg:w-2/3 h-full md:h-full flex-shrink-0">
              <HFCViewer
                baseAvatarUrl={modelImageUrl}
                overlayImageUrl={overlayImageUrl}
                isProcessing={false}
                statusMessage={undefined}
                selectedGarmentName={currentTryOnItem?.name ?? null}
                onStartOver={handleStartOver}
              />
            </div>
            <aside className="w-full md:w-[40%] lg:w-1/3 h-auto md:h-full bg-white flex flex-col">
              {currentTryOnItem && (
                <ProductDetailsPanel
                  item={currentTryOnItem}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                  isInCart={cart.some(cartItem => cartItem.id === currentTryOnItem.id)}
                  onStartOver={handleStartOver}
                />
              )}
            </aside>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-screen h-screen bg-neutral-50 font-sans flex flex-col items-center justify-center overflow-hidden antialiased pt-16">
      <Header
        onCartClick={() => setIsCartOpen(true)}
        cartItemCount={cart.length}
        showBackButton={appState === 'tryon'}
        onBackClick={handleBackToCollection}
      />
      <main className="w-full h-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={appState}
            className="w-full h-full p-4 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-md shadow-lg"
          >
            {error}
          </motion.div>
        )}
      </main>

      {appState === 'start' && <Footer />}

      <AnimatePresence>
        {isGarmentModalOpen && (
          <GarmentDetailsModal
            isOpen={isGarmentModalOpen}
            onClose={() => setIsGarmentModalOpen(false)}
            garment={selectedGarmentForModal}
            onApply={() => {}}
            onAddToCart={handleAddToCart}
            isInCart={selectedGarmentForModal ? cart.some(item => item.id === selectedGarmentForModal.id) : false}
          />
        )}
      </AnimatePresence>

      <ShoppingCartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemove={handleRemoveFromCart}
      />
    </div>
  );
};

export default App;
