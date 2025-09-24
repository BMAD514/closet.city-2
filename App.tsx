/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import { WardrobeItem } from './types';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import GarmentDetailsModal from './components/GarmentDetailsModal';
import ShoppingCartModal from './components/ShoppingCartModal';
import Header from './components/Header';
import CollectionGrid from './components/CollectionGrid';
import ProductDetailsPanel from './components/ProductDetailsPanel';
import ProductGallery from './components/ProductGallery';
import { generatePoseVariation } from './services/geminiService';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Material close-up",
  "Logo close-up",
];

type AppState = 'start' | 'collection' | 'tryon';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('start');
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [currentTryOnItem, setCurrentTryOnItem] = useState<WardrobeItem | null>(null);
  const [currentTryOnPoses, setCurrentTryOnPoses] = useState<Record<string, string>>({});

  const [wardrobe] = useState<WardrobeItem[]>(defaultWardrobe);

  const [cart, setCart] = useState<WardrobeItem[]>(() => {
      try {
          const saved = localStorage.getItem('closet.city.cart');
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          console.error("Failed to parse cart from localStorage", e);
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
        console.error("Failed to save cart to localStorage", e);
    }
  }, [cart]);

  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setAppState('collection');
  };
  
  const handleBrowseAsGuest = () => {
    setModelImageUrl(null);
    setAppState('collection');
  };

  const handleNavigateToTryOn = (item: WardrobeItem, generatedTryOnUrl?: string) => {
    setCurrentTryOnItem(item);
    const initialPoseUrl = modelImageUrl ? generatedTryOnUrl : item.pregeneratedTryOnUrl;
    if (initialPoseUrl) {
      setCurrentTryOnPoses({ [POSE_INSTRUCTIONS[0]]: initialPoseUrl });
    } else {
      // Handle case where even pre-generated URL might be missing
      setError("Main try-on image is not available for this item.");
      setCurrentTryOnPoses({});
    }
    setAppState('tryon');
  };

  const handleBackToCollection = () => {
    setCurrentTryOnItem(null);
    setCurrentTryOnPoses({});
    setError(null);
    setAppState('collection');
  }

  const handlePoseGenerate = useCallback(async (poseInstruction: string) => {
    if (isLoading || !currentTryOnItem || currentTryOnPoses[poseInstruction]) {
      return;
    }
    setError(null);

    // Guest Mode: Use pre-generated images
    if (!modelImageUrl) {
        const instructionIndex = POSE_INSTRUCTIONS.indexOf(poseInstruction);
        let pregenUrl = '';
        if (instructionIndex === 1) pregenUrl = currentTryOnItem.pregeneratedMaterialUrl || '';
        if (instructionIndex === 2) pregenUrl = currentTryOnItem.pregeneratedLogoUrl || '';
        
        if (pregenUrl) {
            setCurrentTryOnPoses(prev => ({ ...prev, [poseInstruction]: pregenUrl }));
        } else {
            setError("This view isn't available for this item.");
        }
        return;
    }

    // Personalized Mode: Generate with AI
    const baseImageForPoseChange = currentTryOnPoses[POSE_INSTRUCTIONS[0]];
    if (!baseImageForPoseChange) {
      setError("Base image not available to generate new pose.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Generating ${poseInstruction}...`);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setCurrentTryOnPoses(prevPoses => ({
        ...prevPoses,
        [poseInstruction]: newImageUrl
      }));
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'Failed to generate view'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [isLoading, currentTryOnPoses, currentTryOnItem, modelImageUrl]);

  const handleStartOver = () => {
    setAppState('start');
    setModelImageUrl(null);
    setCurrentTryOnItem(null);
    setCurrentTryOnPoses({});
    setIsLoading(false);
    setLoadingMessage('');
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
  }
  
  const renderContent = () => {
    switch(appState) {
      case 'start':
        return <StartScreen onModelFinalized={handleModelFinalized} onBrowseAsGuest={handleBrowseAsGuest} />;
      case 'collection':
        return <CollectionGrid 
                  wardrobe={wardrobe} 
                  onItemSelect={handleNavigateToTryOn} 
                  modelImageUrl={modelImageUrl} 
                />;
      case 'tryon':
        return (
          <div className="w-full h-full flex flex-col md:flex-row max-w-7xl mx-auto">
            <div className="w-full md:w-[60%] lg:w-2/3 h-full md:h-full flex-shrink-0">
              <ProductGallery 
                poses={currentTryOnPoses}
                poseInstructions={POSE_INSTRUCTIONS}
                onGeneratePose={handlePoseGenerate}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                isGuestMode={!modelImageUrl}
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
  }

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
            onApply={() => { /* This flow is now handled differently */ }}
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