import { StoreRecord, ProductRecord } from '../types/index.js';
import { templateService } from './templateService.js';

export interface GeneratedFile {
  file: string;
  data: string;
  encoding?: 'utf-8' | 'base64';
}

export const generatorService = {
  compileStorefront(store: StoreRecord, products: ProductRecord[], templateId?: string): GeneratedFile[] {
    const template = templateService.getTemplateById(templateId || store.selected_template_id);
    const activeProducts = products.filter((p) => p.status === 'active');

    const storeConfig = {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        businessType: store.business_type,
        description: store.description || '',
        currency: store.currency || '₹',
        logoUrl: store.logo_url || '',
        bannerUrl: store.banner_url || '',
        contactEmail: store.contact_email || '',
        contactPhone: store.contact_phone || '',
        address: store.address || '',
        socialLinks: store.social_links || {},
        template: template.id,
      },
      theme: template.theme,
      products: activeProducts,
      generatedAt: new Date().toISOString(),
    };

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(store.name)} | Powered by OBSIDIAN</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&family=Cinzel:wght@500;700&family=Syne:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-main: ${template.theme.fontFamily};
      --bg-color: ${template.theme.backgroundColor};
      --card-bg: ${template.theme.cardBackground};
      --primary: ${template.theme.primaryColor};
      --accent: ${template.theme.accentColor};
      --text: ${template.theme.textColor};
      --radius: ${template.theme.radius};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-main);
      background-color: var(--bg-color);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: inherit; }
    .brand-logo { width: 42px; height: 42px; border-radius: var(--radius); object-fit: cover; }
    .brand-title { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
    .banner {
      width: 100%;
      height: 260px;
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .banner-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, var(--bg-color) 100%);
    }
    .banner-content {
      position: relative;
      z-index: 10;
      text-align: center;
      max-width: 700px;
      padding: 1rem;
    }
    .banner-content h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; }
    .banner-content p { font-size: 1.1rem; opacity: 0.85; }
    main { max-width: 1200px; margin: 0 auto; width: 100%; padding: 2rem 1.5rem; flex: 1; }
    .controls { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; justify-content: space-between; align-items: center; }
    .search-input {
      background: var(--card-bg);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--text);
      padding: 0.6rem 1rem;
      border-radius: var(--radius);
      outline: none;
      min-width: 260px;
    }
    .search-input:focus { border-color: var(--accent); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border-radius: var(--radius);
      border: 1px solid rgba(255, 255, 255, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .card-media {
      height: 200px;
      background: rgba(255, 255, 255, 0.03);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4rem;
      overflow: hidden;
    }
    .card-media img { width: 100%; height: 100%; object-fit: cover; }
    .card-body { padding: 1.25rem; display: flex; flex-direction: column; flex: 1; }
    .card-category { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); font-weight: 600; margin-bottom: 0.25rem; }
    .card-title { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; }
    .card-desc { font-size: 0.9rem; opacity: 0.75; margin-bottom: 1rem; flex: 1; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
    .price-box { display: flex; align-items: baseline; gap: 0.5rem; }
    .price { font-size: 1.25rem; font-weight: 700; color: var(--accent); }
    .old-price { text-decoration: line-through; opacity: 0.5; font-size: 0.9rem; }
    .btn-buy {
      background: var(--accent);
      color: #000;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-buy:hover { opacity: 0.9; }
    footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 2rem;
      text-align: center;
      font-size: 0.85rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <header>
    <a href="#" class="brand">
      ${store.logo_url ? `<img src="${escapeHtml(store.logo_url)}" alt="${escapeHtml(store.name)}" class="brand-logo" />` : `<span style="font-size:1.8rem">🏪</span>`}
      <span class="brand-title">${escapeHtml(store.name)}</span>
    </a>
    <div>
      <span style="font-size:0.9rem; opacity:0.8;">${escapeHtml(store.business_type)}</span>
    </div>
  </header>

  ${
    store.banner_url
      ? `<div class="banner" style="background-image: url('${escapeHtml(store.banner_url)}')">
           <div class="banner-overlay"></div>
           <div class="banner-content">
             <h1>${escapeHtml(store.name)}</h1>
             <p>${escapeHtml(store.description || 'Welcome to our storefront')}</p>
           </div>
         </div>`
      : `<div class="banner" style="background: radial-gradient(circle, var(--card-bg) 0%, var(--bg-color) 100%);">
           <div class="banner-content">
             <h1>${escapeHtml(store.name)}</h1>
             <p>${escapeHtml(store.description || 'Welcome to our storefront')}</p>
           </div>
         </div>`
  }

  <main>
    <div class="controls">
      <h2 style="font-size:1.5rem; font-weight:700;">Catalog (${activeProducts.length})</h2>
      <input type="text" id="searchInput" class="search-input" placeholder="Search catalog..." />
    </div>

    <div class="grid" id="productGrid">
      ${activeProducts
        .map(
          (p) => `
        <div class="card" data-name="${escapeHtml(p.name.toLowerCase())}" data-category="${escapeHtml(p.category.toLowerCase())}">
          <div class="card-media">
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" />` : `<span>${escapeHtml(p.emoji || '📦')}</span>`}
          </div>
          <div class="card-body">
            <span class="card-category">${escapeHtml(p.category)}</span>
            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            <p class="card-desc">${escapeHtml(p.description || '')}</p>
            <div class="card-footer">
              <div class="price-box">
                <span class="price">${escapeHtml(store.currency)}${p.discount_price || p.price}</span>
                ${p.discount_price ? `<span class="old-price">${escapeHtml(store.currency)}${p.price}</span>` : ''}
              </div>
              <button class="btn-buy" onclick="alert('Item ordered: ${escapeHtml(p.name)}')">Order Now</button>
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </main>

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(store.name)}. All rights reserved. Powered by OBSIDIAN Storefront.</p>
  </footer>

  <script>
    const searchInput = document.getElementById('searchInput');
    const productGrid = document.getElementById('productGrid');
    if (searchInput && productGrid) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const cards = productGrid.querySelectorAll('.card');
        cards.forEach((card) => {
          const title = card.getAttribute('data-name') || '';
          const cat = card.getAttribute('data-category') || '';
          if (title.includes(query) || cat.includes(query)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    }
  </script>
</body>
</html>`;

    return [
      {
        file: 'index.html',
        data: indexHtml,
        encoding: 'utf-8',
      },
      {
        file: 'store-config.json',
        data: JSON.stringify(storeConfig, null, 2),
        encoding: 'utf-8',
      },
    ];
  },
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
