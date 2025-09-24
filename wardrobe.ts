/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { WardrobeItem } from './types';

// Default wardrobe items hosted for easy access
export const defaultWardrobe: WardrobeItem[] = [
  {
    id: 'gemini-sweat',
    name: 'Archival Sweatshirt',
    url: 'https://raw.githubusercontent.com/ammaarreshi/app-images/refs/heads/main/gemini-sweat-2.png',
    description: 'A classic crewneck sweatshirt with a relaxed fit. Features a subtle embroidered logo.',
    material: '80% Cotton, 20% Polyester',
    size: 'Large',
    price: 95,
    pregeneratedLookbookUrl: 'https://storage.googleapis.com/gemini-95-icons/archival-sweat-lookbook.png',
    pregeneratedTryOnUrl: 'https://storage.googleapis.com/gemini-95-icons/archival-sweat-tryon.png',
    pregeneratedMaterialUrl: 'https://storage.googleapis.com/gemini-95-icons/archival-sweat-material.png',
    pregeneratedLogoUrl: 'https://storage.googleapis.com/gemini-95-icons/archival-sweat-logo.png',
  },
  {
    id: 'gemini-tee',
    name: 'Vintage Graphic Tee',
    url: 'https://raw.githubusercontent.com/ammaarreshi/app-images/refs/heads/main/Gemini-tee.png',
    description: 'A soft, vintage-inspired t-shirt with a unique graphic print. Perfectly worn-in feel.',
    material: '100% Cotton',
    size: 'Medium',
    price: 45,
    pregeneratedLookbookUrl: 'https://storage.googleapis.com/gemini-95-icons/vintage-tee-lookbook.png',
    pregeneratedTryOnUrl: 'https://storage.googleapis.com/gemini-95-icons/vintage-tee-tryon.png',
    pregeneratedMaterialUrl: 'https://storage.googleapis.com/gemini-95-icons/vintage-tee-material.png',
    pregeneratedLogoUrl: 'https://storage.googleapis.com/gemini-95-icons/vintage-tee-logo.png',
  }
];