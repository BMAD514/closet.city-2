/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string; // Can be a remote URL or a base64 data URL for custom uploads
  description?: string;
  material?: string;
  size?: string;
  price?: number;
  // New fields for pre-generated content for the guest/lookbook flow
  pregeneratedLookbookUrl?: string; // For collection grid
  pregeneratedTryOnUrl?: string; // Main shot on product page
  pregeneratedMaterialUrl?: string; // Material close-up
  pregeneratedLogoUrl?: string; // Logo close-up
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}