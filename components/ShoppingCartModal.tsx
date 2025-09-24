/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, Trash2Icon } from './icons';
import { WardrobeItem } from '../types';

interface ShoppingCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: WardrobeItem[];
  onRemove: (itemId: string) => void;
}

const ShoppingCartModal: React.FC<ShoppingCartModalProps> = ({ isOpen, onClose, cartItems, onRemove }) => {
    const subtotal = cartItems.reduce((acc, item) => acc + (item.price || 0), 0);
    const formattedSubtotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 right-0 h-full w-full max-w-md bg-white flex flex-col shadow-2xl"
          >
            <header className="flex items-center justify-between p-4 border-b border-neutral-200 flex-shrink-0">
              <h2 className="text-xl font-serif text-neutral-800">Shopping Bag</h2>
              <button onClick={onClose} className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800" aria-label="Close shopping bag">
                <XIcon className="w-5 h-5"/>
              </button>
            </header>

            <div className="flex-grow p-4 overflow-y-auto">
              {cartItems.length > 0 ? (
                <ul className="divide-y divide-neutral-200">
                  {cartItems.map((item) => (
                    <li key={item.id} className="flex items-start py-4">
                      <div className="w-20 h-20 bg-neutral-100 rounded-md overflow-hidden border border-neutral-200 flex-shrink-0">
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="ml-4 flex-grow">
                        <h3 className="font-semibold text-neutral-800">{item.name}</h3>
                        <p className="text-sm text-neutral-600">{item.size || 'One Size'}</p>
                        <p className="text-sm font-bold text-neutral-900 mt-1">
                            {item.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price) : 'N/A'}
                        </p>
                      </div>
                      <button onClick={() => onRemove(item.id)} className="ml-2 p-2 text-neutral-500 hover:text-red-600" aria-label={`Remove ${item.name} from bag`}>
                        <Trash2Icon className="w-5 h-5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-lg font-serif text-neutral-700">Your bag is empty.</p>
                  <p className="text-sm text-neutral-500 mt-1">Items added to your bag will appear here.</p>
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
                <footer className="p-4 bg-neutral-50 border-t border-neutral-200 flex-shrink-0">
                    <div className="flex justify-between items-center text-md font-semibold mb-4">
                        <span>Subtotal</span>
                        <span>{formattedSubtotal}</span>
                    </div>
                    <button className="w-full relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-black rounded-md cursor-pointer group hover:bg-neutral-800 transition-colors">
                        Proceed to Checkout
                    </button>
                    <p className="text-xs text-neutral-500 text-center mt-2">Shipping & taxes calculated at checkout.</p>
                </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShoppingCartModal;