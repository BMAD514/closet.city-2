/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { WardrobeItem } from '../types';
import { RotateCcwIcon } from './icons';

interface ProductDetailsPanelProps {
  item: WardrobeItem;
  onAddToCart: (item: WardrobeItem) => void;
  onBuyNow: (item: WardrobeItem) => void;
  isInCart: boolean;
  onStartOver: () => void;
}

const ProductDetailsPanel: React.FC<ProductDetailsPanelProps> = ({
  item,
  onAddToCart,
  onBuyNow,
  isInCart,
  onStartOver
}) => {
  return (
    <div className="flex flex-col h-full w-full overflow-y-auto p-6 md:p-8 sticky top-16">
      <div className="flex-grow">
        <h1 className="text-3xl font-serif font-bold text-neutral-900">{item.name}</h1>
        {item.price && (
            <p className="text-lg font-sans text-neutral-800 mt-2">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}
            </p>
        )}
        
        <div className="mt-6 flex flex-col gap-3">
             <button
                  onClick={() => onAddToCart(item)}
                  disabled={isInCart || !item.price}
                  className="w-full relative inline-flex items-center justify-center px-8 py-3 text-sm font-semibold text-white bg-black rounded-md cursor-pointer hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isInCart ? 'Added to Bag' : 'Add to Bag'}
              </button>
        </div>

        <div className="space-y-4 pt-6 mt-6 border-t border-neutral-200">
            <div>
              <h2 className="font-semibold text-neutral-800 mb-2">Description</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">{item.description || 'No description provided.'}</p>
            </div>
            <div>
              <h2 className="font-semibold text-neutral-800 mb-2">Details</h2>
              <ul className="text-sm text-neutral-600 space-y-1 list-disc list-inside">
                <li>Material: {item.material || 'N/A'}</li>
                <li>Size: {item.size || 'N/A'}</li>
              </ul>
            </div>
        </div>
      </div>

      <div className="flex-shrink-0 pt-6 mt-6 border-t border-neutral-200">
         <button 
          onClick={onStartOver}
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors flex items-center gap-2"
        >
            <RotateCcwIcon className="w-3 h-3" />
            Start Over With New Photo
        </button>
      </div>
    </div>
  );
};

export default ProductDetailsPanel;