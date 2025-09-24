/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons';
import { WardrobeItem } from '../types';

interface GarmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  garment: WardrobeItem | null;
  onApply: (garment: WardrobeItem) => void;
  onAddToCart: (garment: WardrobeItem) => void;
  isInCart: boolean;
}

const GarmentDetailsModal: React.FC<GarmentDetailsModalProps> = ({ isOpen, onClose, garment, onApply, onAddToCart, isInCart }) => {

  const handleApply = () => {
    if(garment) {
        onApply(garment);
    }
  }

  const handleAddToCartClick = () => {
      if (garment && !isInCart) {
          onAddToCart(garment);
      }
  }
  
  if (!garment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl overflow-hidden"
            aria-modal="true"
            role="dialog"
            aria-labelledby="garment-details-title"
          >
            <div className="flex items-start justify-between p-4 border-b border-neutral-200">
                <h2 id="garment-details-title" className="text-xl font-serif text-neutral-800 truncate pr-4">
                  {garment.name}
                </h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={onClose} className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>

            <div className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="aspect-square bg-neutral-100 rounded-md overflow-hidden border border-neutral-200">
                <img src={garment.url} alt={garment.name} className="w-full h-full object-cover" />
              </div>

              <div className="flex flex-col">
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-600 leading-relaxed">{garment.description || 'No description provided.'}</p>
                    
                    <div className="space-y-2 pt-4 border-t border-neutral-200 mt-2">
                       {garment.price && (
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-serif font-bold text-neutral-900">Price</span>
                            <span className="font-serif font-bold text-neutral-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(garment.price)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider">Material</span>
                        <span className="font-medium text-neutral-800 text-right">{garment.material || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider">Size</span>
                        <span className="font-medium text-neutral-800 text-right">{garment.size || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col-reverse sm:flex-row-reverse items-center gap-3">
              <button
                onClick={handleApply}
                className="w-full sm:w-auto px-6 py-2 text-sm font-semibold text-white bg-black rounded-md cursor-pointer hover:bg-neutral-800 transition-colors"
              >
                Try it on
              </button>
              <button
                  onClick={handleAddToCartClick}
                  disabled={isInCart || !garment.price}
                  className="w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-2 text-sm font-semibold text-neutral-700 bg-neutral-200 rounded-md cursor-pointer hover:bg-neutral-300 transition-colors disabled:bg-neutral-400 disabled:cursor-not-allowed"
              >
                  {isInCart ? 'In Bag' : 'Add to Bag'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GarmentDetailsModal;