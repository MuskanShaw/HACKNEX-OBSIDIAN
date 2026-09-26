import { Router } from 'express';

const router = Router();

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OBSIDIAN Storefront Platform API',
    version: '1.0.0',
    description:
      'Production-grade RESTful backend API service for the OBSIDIAN digital architectural storefront platform. Supports store creation, product management, customer orders, and automated Vercel deployment orchestration.',
    contact: {
      name: 'OBSIDIAN Support',
      url: 'https://hacknex-obsidian06.vercel.app',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Origin (Auto)',
    },
    {
      url: 'https://hacknex-obsidian06.onrender.com',
      description: 'Production Backend (Render)',
    },
    {
      url: 'https://hacknex-obsidian06.vercel.app',
      description: 'Production Frontend (Vercel)',
    },
    {
      url: 'http://localhost:4000',
      description: 'Local Backend (Port 4000)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local Frontend Proxy (Port 3000)',
    },
  ],
  tags: [
    { name: 'System', description: 'Health check and service status' },
    { name: 'Authentication', description: 'User identity and Supabase token synchronization' },
    { name: 'Account', description: 'Unified dashboard state synchronization and local storage migration' },
    { name: 'Stores', description: 'Store creation, management, templates, location, and branding' },
    { name: 'Products', description: 'Catalog items, inventory stock, categories, and bulk operations' },
    { name: 'Orders', description: 'Customer checkout, order status management, and bulk operations' },
    { name: 'Analytics', description: 'Live telemetry, sales metrics, and performance analytics' },
    { name: 'Realtime', description: 'Server-Sent Events (SSE) live updates stream' },
    { name: 'Maps', description: 'Google Maps geocoding and verified place details' },
    { name: 'Deployments', description: 'Vercel storefront compilation and live deployment orchestration' },
    { name: 'Templates', description: 'Design template catalog' },
    { name: 'Public', description: 'Public storefront data for live site rendering' },
    { name: 'AI Chatbot', description: 'Storefront AI Assistant powered by Google Gemini with user store context' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT Bearer Token, or dev-mock token in development (e.g. Bearer dev-mock-user1)',
      },
      MockUserHeaders: {
        type: 'apiKey',
        in: 'header',
        name: 'x-mock-user-id',
        description: 'Mock user ID header supported in non-production environments',
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'obsidian-backend' },
          ai: { type: 'string', example: 'configured' },
          database: { type: 'string', enum: ['connected', 'disconnected', 'error'], example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
          environment: { type: 'string', example: 'development' },
        },
      },
      ChatRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            description: 'User prompt or inquiry for the AI Storefront assistant',
            example: 'What products are in my store?',
          },
          conversation_id: {
            type: 'string',
            format: 'uuid',
            description: 'Optional conversation ID to maintain continuous session history',
            example: 'c1234567-89ab-cdef-0123-456789abcdef',
          },
        },
      },
      ChatResponse: {
        type: 'object',
        properties: {
          reply: {
            type: 'string',
            description: 'AI-generated response from Google Gemini',
            example: 'You have 3 products listed in your store: Premium Jacket, Silk Shirt, and Classic Denim.',
          },
          conversation_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID identifier of the ongoing conversation session',
            example: 'c1234567-89ab-cdef-0123-456789abcdef',
          },
        },
      },
      RootServiceResponse: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'OBSIDIAN Storefront Backend Service' },
          version: { type: 'string', example: '1.0.0' },
          documentation: { type: 'string', example: '/api/docs' },
          health: { type: 'string', example: '/health' },
        },
      },
      Template: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'obsidian-classic' },
          name: { type: 'string', example: 'Obsidian Classic' },
          description: { type: 'string', example: 'High-contrast obsidian dark aesthetic...' },
          thumbnail_url: { type: 'string', example: 'https://assets.obsidian.store/templates/classic-preview.webp' },
          category: { type: 'string', example: 'Modern Dark' },
          theme: {
            type: 'object',
            properties: {
              fontFamily: { type: 'string', example: "'Inter', sans-serif" },
              primaryColor: { type: 'string', example: '#0f172a' },
              accentColor: { type: 'string', example: '#38bdf8' },
              backgroundColor: { type: 'string', example: '#020617' },
              cardBackground: { type: 'string', example: '#0f172a' },
              textColor: { type: 'string', example: '#f8fafc' },
              radius: { type: 'string', example: '0.5rem' },
            },
          },
        },
      },
      Store: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '301cb1dc-25fe-4fc5-a916-f81dcd701d11' },
          user_id: { type: 'string', example: 'user_001' },
          userId: { type: 'string', example: 'user_001' },
          owner_id: { type: 'string', nullable: true },
          ownerId: { type: 'string', nullable: true },
          name: { type: 'string', example: 'Apex Studio Goods' },
          store_name: { type: 'string', example: 'Apex Studio Goods' },
          shopName: { type: 'string', example: 'Apex Studio Goods' },
          slug: { type: 'string', example: 'apex-studio-goods' },
          business_type: { type: 'string', example: 'Apparel & Accessories' },
          businessType: { type: 'string', example: 'Apparel & Accessories' },
          custom_business_type: { type: 'string', nullable: true },
          customBusinessType: { type: 'string', nullable: true },
          custom_options: { type: 'array', items: { type: 'string' } },
          customOptions: { type: 'array', items: { type: 'string' } },
          description: { type: 'string', example: 'Curated architectural luxury apparel.' },
          currency: { type: 'string', example: '₹' },
          storeCurrency: { type: 'string', example: '₹' },
          logo_url: { type: 'string', nullable: true },
          logoUrl: { type: 'string', nullable: true },
          banner_url: { type: 'string', nullable: true },
          bannerUrl: { type: 'string', nullable: true },
          contact_email: { type: 'string', example: 'hello@apexstudio.com' },
          contactEmail: { type: 'string', example: 'hello@apexstudio.com' },
          contact_phone: { type: 'string', example: '+1 555 0192' },
          contactPhone: { type: 'string', example: '+1 555 0192' },
          phone: { type: 'string', example: '+1 555 0192' },
          address: { type: 'string', example: '742 Evergreen Terrace' },
          shopAddress: { type: 'string', example: '742 Evergreen Terrace' },
          address_method: { type: 'string', example: 'manual' },
          addressMethod: { type: 'string', example: 'manual' },
          latitude: { type: 'number', nullable: true, example: 12.9716 },
          longitude: { type: 'number', nullable: true, example: 77.5946 },
          place_id: { type: 'string', nullable: true },
          placeId: { type: 'string', nullable: true },
          formatted_address: { type: 'string', nullable: true },
          formattedAddress: { type: 'string', nullable: true },
          maps_url: { type: 'string', nullable: true },
          mapsUrl: { type: 'string', nullable: true },
          location_source: { type: 'string', nullable: true, example: 'google_maps' },
          locationSource: { type: 'string', nullable: true, example: 'google_maps' },
          social_links: {
            type: 'object',
            properties: {
              instagram: { type: 'string' },
              facebook: { type: 'string' },
              twitter: { type: 'string' },
              whatsapp: { type: 'string' },
            },
          },
          socialLinks: {
            type: 'object',
            properties: {
              instagram: { type: 'string' },
              facebook: { type: 'string' },
              twitter: { type: 'string' },
              whatsapp: { type: 'string' },
            },
          },
          selected_template_id: { type: 'string', example: 'obsidian-classic' },
          selectedTemplateId: { type: 'string', example: 'obsidian-classic' },
          live_url: { type: 'string', nullable: true, example: 'https://apex-studio.vercel.app' },
          liveUrl: { type: 'string', nullable: true, example: 'https://apex-studio.vercel.app' },
          vercel_project_id: { type: 'string', nullable: true },
          vercelProjectId: { type: 'string', nullable: true },
          is_deployed: { type: 'boolean', example: false },
          isDefault: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 101 },
          backendId: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Monolith Overcoat' },
          category: { type: 'string', example: 'Apparel' },
          price: { type: 'number', example: 450 },
          discountPrice: { type: 'number', nullable: true, example: 380 },
          discount_price: { type: 'number', nullable: true, example: 380 },
          stock: { type: 'integer', example: 15 },
          emoji: { type: 'string', example: '🧥' },
          image: { type: 'string', nullable: true },
          image_url: { type: 'string', nullable: true },
          description: { type: 'string', example: 'Heavyweight wool-blend minimalist trench.' },
          status: { type: 'string', enum: ['active', 'draft', 'archived'], example: 'active' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 101 },
          productId: { type: 'integer', example: 101 },
          product_id: { type: 'string' },
          name: { type: 'string', example: 'Monolith Overcoat' },
          productName: { type: 'string', example: 'Monolith Overcoat' },
          quantity: { type: 'integer', default: 1 },
          qty: { type: 'integer', default: 1 },
          price: { type: 'number', example: 450 },
          unitPrice: { type: 'number', example: 450 },
          emoji: { type: 'string', example: '🧥' },
          image: { type: 'string', nullable: true },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 17290123 },
          backendId: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          customerName: { type: 'string', example: 'Alex Mercer' },
          customer_name: { type: 'string', example: 'Alex Mercer' },
          customerEmail: { type: 'string', nullable: true, example: 'alex@example.com' },
          customer_email: { type: 'string', nullable: true, example: 'alex@example.com' },
          customerPhone: { type: 'string', nullable: true, example: '+1 555 0192' },
          customer_phone: { type: 'string', nullable: true, example: '+1 555 0192' },
          phone: { type: 'string', nullable: true, example: '+1 555 0192' },
          customerAddress: { type: 'string', nullable: true, example: '742 Evergreen Terrace' },
          customer_address: { type: 'string', nullable: true, example: '742 Evergreen Terrace' },
          address: { type: 'string', nullable: true, example: '742 Evergreen Terrace' },
          paymentMethod: { type: 'string', nullable: true, example: 'card' },
          payment_method: { type: 'string', nullable: true, example: 'card' },
          productName: { type: 'string', example: 'Monolith Overcoat (x1)' },
          product_name: { type: 'string', example: 'Monolith Overcoat (x1)' },
          productId: { type: 'integer', nullable: true, example: 101 },
          product_id: { type: 'string', nullable: true },
          quantity: { type: 'integer', example: 1 },
          totalPrice: { type: 'number', example: 450 },
          total_price: { type: 'number', example: 450 },
          totalAmount: { type: 'number', example: 450 },
          total_amount: { type: 'number', example: 450 },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
          },
          order_items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
          },
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'cancelled'], example: 'processing' },
          date: { type: 'string', example: 'Sep 21, 2026' },
          order_date: { type: 'string', example: '2026-09-21T10:00:00.000Z' },
        },
      },
      Analytics: {
        type: 'object',
        properties: {
          totalSales: { type: 'number', example: 4500.5 },
          totalOrders: { type: 'integer', example: 12 },
          uniqueCustomers: { type: 'integer', example: 8 },
          totalProducts: { type: 'integer', example: 25 },
          totalStock: { type: 'integer', example: 180 },
          lowStockCount: { type: 'integer', example: 3 },
          chart: {
            type: 'object',
            properties: {
              labels: { type: 'array', items: { type: 'string' }, example: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
              values: { type: 'array', items: { type: 'number' }, example: [120, 450, 300, 800, 0, 950, 450] },
            },
          },
          timeframe: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'], example: 'monthly' },
          lastUpdated: { type: 'string', format: 'date-time' },
        },
      },
      DashboardState: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              fullName: { type: 'string', nullable: true },
              ownerName: { type: 'string', nullable: true },
              avatarUrl: { type: 'string', nullable: true },
            },
          },
          store: { $ref: '#/components/schemas/Store' },
          products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
          orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
          analytics: { $ref: '#/components/schemas/Analytics' },
        },
      },
      DeploymentStatus: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'live' },
          state: { type: 'string', enum: ['QUEUED', 'BUILDING', 'READY', 'ERROR', 'CANCELED', 'NOT_DEPLOYED'], example: 'READY' },
          statusMessage: { type: 'string', example: 'Deployment successful' },
          message: { type: 'string', example: 'Store deployed successfully' },
          deploymentId: { type: 'string', nullable: true, example: 'dpl_123' },
          liveUrl: { type: 'string', nullable: true, example: 'https://apex-studio.vercel.app' },
          deploymentUrl: { type: 'string', nullable: true, example: 'https://apex-studio.vercel.app' },
          errorMessage: { type: 'string', nullable: true },
          isMock: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'Service overview and discovery metadata',
        responses: {
          200: {
            description: 'Backend service metadata and endpoint links',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RootServiceResponse' } } },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Service health check',
        responses: {
          200: {
            description: 'Backend is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/api/chat': {
      post: {
        tags: ['AI Chatbot'],
        summary: 'Send message to AI Storefront Chatbot (Google Gemini)',
        description: 'Authenticates user via Supabase JWT, retrieves user store catalog context, persists conversation history, and invokes Google Gemini.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Chat response generated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatResponse' },
              },
            },
          },
          400: { description: 'Invalid request or empty message' },
          401: { description: 'Unauthorized: missing or invalid Supabase access token' },
          403: { description: 'Forbidden: conversation does not belong to authenticated user' },
          404: { description: 'Not Found: conversation does not exist' },
          429: { description: 'Rate limit exceeded: too many chat messages' },
          502: { description: 'AI Service Error: Gemini API temporarily unavailable' },
        },
      },
    },
    '/api/chat/conversations': {
      get: {
        tags: ['AI Chatbot'],
        summary: 'List user conversations',
        description: 'Returns all chat conversations belonging strictly to the authenticated user.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'List of conversations' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/chat/conversations/{id}/messages': {
      get: {
        tags: ['AI Chatbot'],
        summary: 'Get conversation message history',
        description: 'Retrieves all messages for a specific conversation belonging to the authenticated user.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Conversation ID',
          },
        ],
        responses: {
          200: { description: 'Conversation messages' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden: conversation does not belong to user' },
          404: { description: 'Conversation not found' },
        },
      },
    },
    '/api/templates': {
      get: {
        tags: ['Templates'],
        summary: 'Get all available storefront templates',
        responses: {
          200: {
            description: 'Catalog of design templates',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    templates: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Template' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account with Supabase Auth',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'alex@obsidian.store' },
                  password: { type: 'string', minLength: 6, example: 'secret123456' },
                  full_name: { type: 'string', example: 'Alex Morgan' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration successful, returns user profile and JWT token' },
          400: { description: 'Validation or registration error' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate with Supabase email & password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'alex@obsidian.store' },
                  password: { type: 'string', example: 'secret123456' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful, returns JWT access token and user' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        responses: {
          200: { description: 'Authenticated user profile' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/sync': {
      post: {
        tags: ['Authentication'],
        summary: 'Sync authenticated Supabase user profile',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        responses: {
          200: { description: 'User synced successfully' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/update-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Update password for the authenticated user',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string', minLength: 6, example: 'newSecurePassword123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password updated successfully' },
          400: { description: 'Validation or update error' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/account/state': {
      get: {
        tags: ['Account'],
        summary: 'Retrieve complete unified dashboard state for authenticated merchant',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        responses: {
          200: {
            description: 'Unified dashboard state (store, products, orders, analytics)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DashboardState' } } },
          },
          401: { description: 'Unauthorized' },
        },
      },
      put: {
        tags: ['Account'],
        summary: 'Synchronize complete store state, products, and orders idempotently',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  store: { type: 'object' },
                  products: { type: 'array', items: { type: 'object' } },
                  orders: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Dashboard state synchronized successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Dashboard state synchronized successfully' },
                    state: { $ref: '#/components/schemas/DashboardState' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/account/import-local-state': {
      post: {
        tags: ['Account'],
        summary: 'One-time migration from browser localStorage to PostgreSQL backend',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  store: { type: 'object' },
                  products: { type: 'array', items: { type: 'object' } },
                  orders: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Local storage data migrated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Local storage data imported successfully into Supabase' },
                    state: { $ref: '#/components/schemas/DashboardState' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/maps/geocode': {
      post: {
        tags: ['Maps'],
        summary: 'Geocode address string to latitude, longitude, and place details',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['address'],
                properties: { address: { type: 'string', example: 'Koramangala, Bengaluru' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Geocoding successful' },
        },
      },
    },
    '/api/maps/place-details': {
      post: {
        tags: ['Maps'],
        summary: 'Retrieve verified place details from place ID',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['placeId'],
                properties: { placeId: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Place details retrieved' },
        },
      },
    },
    '/api/stores/me': {
      get: {
        tags: ['Stores'],
        summary: 'List stores owned by the authenticated user',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        responses: {
          200: {
            description: 'List of user stores',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    stores: { type: 'array', items: { $ref: '#/components/schemas/Store' } },
                    defaultStore: { $ref: '#/components/schemas/Store' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/stores': {
      post: {
        tags: ['Stores'],
        summary: 'Create a new storefront',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'business_type'],
                properties: {
                  name: { type: 'string', example: 'Apex Studio' },
                  store_name: { type: 'string', example: 'Apex Studio' },
                  business_type: { type: 'string', example: 'clothing' },
                  custom_business_type: { type: 'string', nullable: true },
                  custom_options: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string', example: 'Modern clothing monument.' },
                  currency: { type: 'string', default: '₹' },
                  address: { type: 'string', example: '742 Evergreen Terrace' },
                  address_method: { type: 'string', default: 'manual' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  place_id: { type: 'string', nullable: true },
                  formatted_address: { type: 'string', nullable: true },
                  maps_url: { type: 'string', nullable: true },
                  location_source: { type: 'string', example: 'google_maps' },
                  contact_email: { type: 'string', example: 'hello@apexstudio.com' },
                  contact_phone: { type: 'string', example: '+1 555 0192' },
                  selected_template_id: { type: 'string', default: 'obsidian-classic' },
                  is_default: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Store created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Store created successfully' },
                    store: { $ref: '#/components/schemas/Store' },
                    formattedStore: { $ref: '#/components/schemas/Store' },
                    rawStore: { type: 'object' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/stores/{id}': {
      get: {
        tags: ['Stores'],
        summary: 'Get store by ID',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Store details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    store: { $ref: '#/components/schemas/Store' },
                    formattedStore: { $ref: '#/components/schemas/Store' },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden' },
          404: { description: 'Store not found' },
        },
      },
      patch: {
        tags: ['Stores'],
        summary: 'Update store attributes',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  store_name: { type: 'string' },
                  business_type: { type: 'string' },
                  custom_business_type: { type: 'string', nullable: true },
                  custom_options: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' },
                  currency: { type: 'string' },
                  logo_url: { type: 'string' },
                  banner_url: { type: 'string' },
                  contact_email: { type: 'string' },
                  contact_phone: { type: 'string' },
                  address: { type: 'string' },
                  address_method: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  place_id: { type: 'string', nullable: true },
                  formatted_address: { type: 'string', nullable: true },
                  maps_url: { type: 'string', nullable: true },
                  location_source: { type: 'string' },
                  selected_template_id: { type: 'string' },
                  is_default: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Store updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    store: { $ref: '#/components/schemas/Store' },
                    formattedStore: { $ref: '#/components/schemas/Store' },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden' },
        },
      },
      put: {
        tags: ['Stores'],
        summary: 'Replace/update full store attributes',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  store_name: { type: 'string' },
                  business_type: { type: 'string' },
                  custom_business_type: { type: 'string', nullable: true },
                  custom_options: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' },
                  currency: { type: 'string' },
                  logo_url: { type: 'string' },
                  banner_url: { type: 'string' },
                  contact_email: { type: 'string' },
                  contact_phone: { type: 'string' },
                  address: { type: 'string' },
                  address_method: { type: 'string' },
                  latitude: { type: 'number', nullable: true },
                  longitude: { type: 'number', nullable: true },
                  place_id: { type: 'string', nullable: true },
                  formatted_address: { type: 'string', nullable: true },
                  maps_url: { type: 'string', nullable: true },
                  location_source: { type: 'string' },
                  selected_template_id: { type: 'string' },
                  is_default: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Store updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    store: { $ref: '#/components/schemas/Store' },
                    formattedStore: { $ref: '#/components/schemas/Store' },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden' },
        },
      },
      delete: {
        tags: ['Stores'],
        summary: 'Delete store and cascade all associated products and orders',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Store deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Store deleted successfully' },
                    deletedStoreId: { type: 'string' },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden' },
          404: { description: 'Store not found' },
        },
      },
    },
    '/api/stores/{id}/location': {
      patch: {
        tags: ['Stores'],
        summary: 'Update store map coordinates and verified location',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['latitude', 'longitude'],
                properties: {
                  latitude: { type: 'number', example: 12.9716 },
                  longitude: { type: 'number', example: 77.5946 },
                  formattedAddress: { type: 'string' },
                  placeId: { type: 'string' },
                  mapsUrl: { type: 'string' },
                  locationSource: { type: 'string', enum: ['manual', 'google_maps', 'google_places'], default: 'google_maps' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Store location updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Store location updated successfully' },
                    location: {
                      type: 'object',
                      properties: {
                        latitude: { type: 'number' },
                        longitude: { type: 'number' },
                        placeId: { type: 'string', nullable: true },
                        formattedAddress: { type: 'string', nullable: true },
                        mapsUrl: { type: 'string', nullable: true },
                        locationSource: { type: 'string', nullable: true },
                      },
                    },
                    store: { $ref: '#/components/schemas/Store' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/upload': {
      post: {
        tags: ['Stores'],
        summary: 'Upload store logo, banner, or product image to Supabase Storage',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'category'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  category: { type: 'string', enum: ['logo', 'banner', 'product'], default: 'product' },
                  productId: { type: 'string', description: 'Product ID or numeric client ID when category is product' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Asset uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Asset uploaded successfully' },
                    category: { type: 'string', example: 'logo' },
                    url: { type: 'string', example: 'https://xyz.supabase.co/storage/v1/object/public/store-assets/stores/uuid/logo/abc.png' },
                    path: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/select-template': {
      post: {
        tags: ['Stores'],
        summary: 'Bind storefront template to store',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['templateId'],
                properties: { templateId: { type: 'string', example: 'obsidian-classic' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Template selected',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Template updated successfully' },
                    store: { $ref: '#/components/schemas/Store' },
                    formattedStore: { $ref: '#/components/schemas/Store' },
                    template: { $ref: '#/components/schemas/Template' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/products': {
      get: {
        tags: ['Products'],
        summary: 'List products in store catalog',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'draft', 'archived'] } },
        ],
        responses: {
          200: {
            description: 'List of products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    rawProducts: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a new product',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  id: { type: 'integer', example: 101 },
                  clientId: { type: 'integer', example: 101 },
                  name: { type: 'string', example: 'Obsidian Ring' },
                  category: { type: 'string', example: 'Jewelry' },
                  price: { type: 'number', example: 120 },
                  discountPrice: { type: 'number', example: 99 },
                  discount_price: { type: 'number', example: 99 },
                  stock: { type: 'integer', default: 10 },
                  emoji: { type: 'string', default: '💍' },
                  description: { type: 'string', example: 'Matte black titanium band.' },
                  image: { type: 'string', nullable: true },
                  image_url: { type: 'string', nullable: true },
                  status: { type: 'string', enum: ['active', 'draft', 'archived'], default: 'active' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Product created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Product created successfully' },
                    product: { $ref: '#/components/schemas/Product' },
                    rawProduct: { type: 'object' },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Clear all products from store',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'All products cleared',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Successfully cleared 5 products from store' },
                    clearedCount: { type: 'integer', example: 5 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/products/{productId}': {
      get: {
        tags: ['Products'],
        summary: 'Retrieve a single product by client numeric ID or UUID',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Product details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    product: { $ref: '#/components/schemas/Product' },
                    rawProduct: { type: 'object' },
                  },
                },
              },
            },
          },
          404: { description: 'Product not found' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update an existing product (resolves numeric client ID or UUID)',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  discountPrice: { type: 'number', nullable: true },
                  discount_price: { type: 'number', nullable: true },
                  stock: { type: 'integer' },
                  emoji: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  image: { type: 'string' },
                  image_url: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'draft', 'archived'] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Product updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Product updated successfully' },
                    product: { $ref: '#/components/schemas/Product' },
                    rawProduct: { type: 'object' },
                  },
                },
              },
            },
          },
          404: { description: 'Product not found' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete a single product',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Product deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Product deleted successfully' },
                    deletedId: { type: 'string', example: '101' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/products/{productId}/stock': {
      patch: {
        tags: ['Products'],
        summary: 'Adjust product stock inventory safely',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  delta: { type: 'integer', example: 10 },
                  stock: { type: 'integer', example: 25 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Stock updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Stock updated successfully' },
                    product: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List orders for store owner',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'List of customer orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                    rawOrders: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden' },
        },
      },
      post: {
        tags: ['Orders'],
        summary: 'Place a new customer order with atomic inventory deduction (Supports nested items or single product)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 17290123 },
                  customerName: { type: 'string', example: 'Jane Doe' },
                  customer_name: { type: 'string', example: 'Jane Doe' },
                  customerEmail: { type: 'string', format: 'email', example: 'jane@example.com' },
                  customer_email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  customerPhone: { type: 'string', example: '+91 98765 43210' },
                  customer_phone: { type: 'string', example: '+91 98765 43210' },
                  phone: { type: 'string', example: '+91 98765 43210' },
                  customerAddress: { type: 'string', example: '42 Regent St, London' },
                  customer_address: { type: 'string', example: '42 Regent St, London' },
                  address: { type: 'string', example: '42 Regent St, London' },
                  paymentMethod: { type: 'string', example: 'card' },
                  payment_method: { type: 'string', example: 'card' },
                  items: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/OrderItem' },
                  },
                  order_items: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/OrderItem' },
                  },
                  productName: { type: 'string', example: 'Monolith Overcoat (x1)' },
                  product_name: { type: 'string', example: 'Monolith Overcoat (x1)' },
                  productId: { type: 'integer', example: 101 },
                  product_id: { type: 'string', example: '101' },
                  quantity: { type: 'integer', default: 1 },
                  totalPrice: { type: 'number', example: 450 },
                  total_price: { type: 'number', example: 450 },
                  totalAmount: { type: 'number', example: 450 },
                  total_amount: { type: 'number', example: 450 },
                  status: { type: 'string', enum: ['pending', 'processing', 'completed', 'cancelled'], default: 'pending' },
                  date: { type: 'string' },
                  order_date: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Order placed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Order created successfully' },
                    order: { $ref: '#/components/schemas/Order' },
                    rawOrder: { type: 'object' },
                    remainingStock: { type: 'integer', example: 9 },
                  },
                },
              },
            },
          },
          400: { description: 'Insufficient stock or invalid input' },
        },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Clear all orders from store',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'All orders cleared',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Successfully cleared 12 orders from store' },
                    clearedCount: { type: 'integer', example: 12 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/orders/{orderId}': {
      get: {
        tags: ['Orders'],
        summary: 'Retrieve a single order by ID or client ID',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Single order details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    order: { $ref: '#/components/schemas/Order' },
                  },
                },
              },
            },
          },
          404: { description: 'Order not found' },
        },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Delete a single order',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Order deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Order deleted successfully' },
                    deletedId: { type: 'string', example: '17290123' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/orders/{orderId}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update order fulfillment status',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['pending', 'processing', 'completed', 'cancelled'] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Order status updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Order status updated successfully' },
                    order: { $ref: '#/components/schemas/Order' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/analytics': {
      get: {
        tags: ['Analytics'],
        summary: 'Computes live store sales, conversion rate, and revenue telemetry',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'timeframe', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' } },
        ],
        responses: {
          200: {
            description: 'Calculated analytics telemetry',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    analytics: { $ref: '#/components/schemas/Analytics' },
                    totalSales: { type: 'number' },
                    totalOrders: { type: 'integer' },
                    uniqueCustomers: { type: 'integer' },
                    totalProducts: { type: 'integer' },
                    totalStock: { type: 'integer' },
                    lowStockCount: { type: 'integer' },
                    chart: {
                      type: 'object',
                      properties: {
                        labels: { type: 'array', items: { type: 'string' } },
                        values: { type: 'array', items: { type: 'number' } },
                      },
                    },
                    timeframe: { type: 'string' },
                    lastUpdated: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/realtime': {
      get: {
        tags: ['Realtime'],
        summary: 'Server-Sent Events (SSE) stream for live updates (products, orders, stock)',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'SSE event stream opened (Content-Type: text/event-stream)',
          },
        },
      },
    },
    '/api/stores/{id}/deploy': {
      post: {
        tags: ['Deployments'],
        summary: 'Compile storefront bundle and trigger deployment to Vercel',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Deployment initiated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Store deployed successfully' },
                    deploymentId: { type: 'string', example: 'dpl_123' },
                    status: { type: 'string', example: 'live' },
                    state: { type: 'string', example: 'READY' },
                    statusMessage: { type: 'string', example: 'Deployment successful' },
                    liveUrl: { type: 'string', nullable: true, example: 'https://apex-studio.vercel.app' },
                    deploymentUrl: { type: 'string', example: 'https://apex-studio.vercel.app' },
                    errorMessage: { type: 'string', nullable: true },
                    isMock: { type: 'boolean', example: false },
                    deployment: { type: 'object' },
                    store: { $ref: '#/components/schemas/Store' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/stores/{id}/deployment-status': {
      get: {
        tags: ['Deployments'],
        summary: 'Check latest deployment status',
        security: [{ BearerAuth: [] }, { MockUserHeaders: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Current deployment status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeploymentStatus' },
              },
            },
          },
        },
      },
    },
    '/api/public/store/{slug}': {
      get: {
        tags: ['Public'],
        summary: 'Public storefront data for live client rendering',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Complete store, products, and theme information for rendering',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    store: { $ref: '#/components/schemas/Store' },
                    template: { $ref: '#/components/schemas/Template' },
                    products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    rawProducts: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          404: { description: 'Storefront not found' },
        },
      },
    },
  },
};

// Return OpenAPI JSON (supports /swagger.json and /openapi.json)
router.get(['/swagger.json', '/openapi.json'], (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Return Interactive Swagger UI
router.get('/', (_req, res) => {
  // Relax CSP specifically for Swagger UI documentation page
  res.removeHeader('Content-Security-Policy');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OBSIDIAN Backend API — Swagger Documentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body {
      margin: 0;
      background: #090d16;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .top-banner {
      background: linear-gradient(90deg, #0b0f19 0%, #172136 100%);
      border-bottom: 1px solid #1e293b;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-badge {
      background: #0284c7;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      letter-spacing: normal;
    }
    .top-links a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.9rem;
      margin-left: 16px;
      transition: color 0.2s;
    }
    .top-links a:hover {
      color: #38bdf8;
    }
    /* Swagger UI Theme Enhancements */
    .swagger-ui .topbar { display: none; }
    .swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #ffffff;
      border-radius: 8px;
      margin-top: 24px;
      margin-bottom: 40px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
  </style>
</head>
<body>
  <div class="top-banner">
    <div class="brand-title">
      <span>OBSIDIAN API SPECIFICATION</span>
      <span class="brand-badge">OpenAPI 3.0</span>
    </div>
    <div class="top-links">
      <a href="/health" target="_blank">Health Check</a>
      <a href="/api/docs/swagger.json" target="_blank">Raw JSON Spec</a>
      <a href="https://hacknex-obsidian06.vercel.app" target="_blank">Vercel Storefront ↗</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: window.location.origin + "/api/docs/swagger.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;

  res.send(html);
});

export default router;
