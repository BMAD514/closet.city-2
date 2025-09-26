/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WardrobeItem } from '../types';
import { defaultWardrobe } from '../wardrobe';

const DEFAULT_BASE_URL = 'http://localhost:4000';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/?$/, '') ?? DEFAULT_BASE_URL;

interface CatalogResponse {
  items: WardrobeItem[];
}

const toJson = async (response: Response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

export const fetchCatalog = async (token: string): Promise<WardrobeItem[]> => {
  if (!token) {
    return defaultWardrobe;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/catalog`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = await toJson(response);
      const message = typeof payload.error === 'string' ? payload.error : 'Failed to load catalog.';
      throw new Error(message);
    }

    const data = (await response.json()) as CatalogResponse;
    if (!data || !Array.isArray(data.items)) {
      throw new Error('Catalog response missing items array.');
    }

    return data.items.map(normalizeCatalogItem);
  } catch (error) {
    console.warn('Falling back to placeholder catalog data:', error);
    return defaultWardrobe;
  }
};

const normalizeCatalogItem = (item: WardrobeItem): WardrobeItem => {
  const normalizedPrice =
    typeof item.price === 'string'
      ? Number.parseFloat(item.price)
      : item.price;

  const price = Number.isFinite(normalizedPrice ?? NaN)
    ? Number(normalizedPrice)
    : undefined;

  return {
    ...item,
    price,
  };
};

