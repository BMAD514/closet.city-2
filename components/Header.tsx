/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ShoppingBagIcon, ChevronLeftIcon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';

interface HeaderProps {
    onCartClick: () => void;
    cartItemCount: number;
    showBackButton?: boolean;
    onBackClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onCartClick, cartItemCount, showBackButton, onBackClick }) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-neutral-200 p-3 z-40">
      <div className="mx-auto flex items-center justify-between text-xs text-neutral-800 font-semibold tracking-widest uppercase max-w-7xl px-4">
        <div className="flex items-center gap-4">
            <AnimatePresence>
            {showBackButton && (
                <motion.button 
                    onClick={onBackClick} 
                    className="flex items-center gap-1 text-sm normal-case font-medium text-neutral-600 hover:text-black"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                    Back to Collection
                </motion.button>
            )}
            </AnimatePresence>
        </div>
        
        <p className="absolute left-1/2 -translate-x-1/2">closet.city</p>

        <button onClick={onCartClick} className="relative" aria-label={`Open shopping bag, ${cartItemCount} items`}>
            <ShoppingBagIcon className="w-6 h-6 text-neutral-900" />
            {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-black text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                    {cartItemCount}
                </span>
            )}
        </button>
      </div>
    </header>
  );
};

export default Header;
