import { StoreTemplate } from '../types/index.js';

export const TEMPLATES: StoreTemplate[] = [
  {
    id: 'obsidian-classic',
    name: 'Obsidian Classic',
    description: 'High-contrast obsidian dark aesthetic designed for modern commerce and electronics.',
    thumbnail_url: 'https://assets.obsidian.store/templates/classic-preview.webp',
    category: 'Modern Dark',
    theme: {
      fontFamily: "'Inter', sans-serif",
      primaryColor: '#0f172a',
      accentColor: '#38bdf8',
      backgroundColor: '#020617',
      cardBackground: '#0f172a',
      textColor: '#f8fafc',
      radius: '0.5rem',
    },
  },
  {
    id: 'obsidian-minimal',
    name: 'Obsidian Minimal',
    description: 'Monochrome, ultra-clean aesthetic with generous whitespace, perfect for curated apparel.',
    thumbnail_url: 'https://assets.obsidian.store/templates/minimal-preview.webp',
    category: 'Minimalist',
    theme: {
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      primaryColor: '#18181b',
      accentColor: '#10b981',
      backgroundColor: '#ffffff',
      cardBackground: '#f4f4f5',
      textColor: '#09090b',
      radius: '0.25rem',
    },
  },
  {
    id: 'obsidian-luxury',
    name: 'Obsidian Luxury',
    description: 'Opulent gold-accented palette crafted for premium jewelry, fragrances, and luxury goods.',
    thumbnail_url: 'https://assets.obsidian.store/templates/luxury-preview.webp',
    category: 'Luxury',
    theme: {
      fontFamily: "'Cinzel', 'Playfair Display', serif",
      primaryColor: '#1c1917',
      accentColor: '#fbbf24',
      backgroundColor: '#0c0a09',
      cardBackground: '#1c1917',
      textColor: '#fafaf9',
      radius: '0.125rem',
    },
  },
  {
    id: 'obsidian-editorial',
    name: 'Obsidian Editorial',
    description: 'Bold typography, expressive borders, and editorial layouts for artisan boutiques.',
    thumbnail_url: 'https://assets.obsidian.store/templates/editorial-preview.webp',
    category: 'Editorial',
    theme: {
      fontFamily: "'Syne', sans-serif",
      primaryColor: '#27272a',
      accentColor: '#ec4899',
      backgroundColor: '#18181b',
      cardBackground: '#27272a',
      textColor: '#fafafa',
      radius: '0.75rem',
    },
  },
];

export const templateService = {
  getAllTemplates(): StoreTemplate[] {
    return TEMPLATES;
  },

  getTemplateById(id: string): StoreTemplate {
    const found = TEMPLATES.find((t) => t.id === id);
    return found || TEMPLATES[0];
  },
};
