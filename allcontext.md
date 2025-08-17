# Swoop Platform - Complete Architecture & Implementation Guide

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Core Features](#core-features)
5. [Data Models](#data-models)
6. [Authentication System](#authentication-system)
7. [State Management](#state-management)
8. [API Endpoints](#api-endpoints)
9. [Payment Integration](#payment-integration)
10. [File Processing](#file-processing)
11. [UI/UX Design System](#uiux-design-system)
12. [Service Worker & PWA](#service-worker--pwa)
13. [Environment Configuration](#environment-configuration)
14. [Development Setup](#development-setup)
15. [Deployment](#deployment)
16. [Security Considerations](#security-considerations)

## Platform Overview

**Swoop** is a comprehensive print service platform that connects users with print shops. It enables users to upload PDF documents, configure print settings, select shops, and complete payments through a mobile-first web application.

### Key Capabilities
- **User Authentication**: Phone/email-based authentication with Firebase
- **Document Upload**: PDF processing with page rotation and preview
- **Print Configuration**: Paper size, color, binding, and quantity settings
- **Shop Selection**: Browse and select print shops with pricing
- **Payment Processing**: Razorpay integration for secure transactions
- **Order Management**: Track print orders from upload to completion
- **PWA Support**: Progressive Web App with offline capabilities

## Technology Stack

### Frontend Framework
- **Next.js 15.4.6**: React framework with App Router
- **React 19.1.1**: UI library with latest features
- **TypeScript 5.9.2**: Type-safe development

### Styling & UI
- **Tailwind CSS 4.1.11**: Utility-first CSS framework
- **ShadCN/UI**: Component library built on Radix UI
- **Lucide React**: Icon library
- **Geist Font**: Typography system

### State Management
- **Zustand 4.5.2**: Lightweight state management
- **Immer**: Immutable state updates

### Authentication & Backend
- **Firebase 10.12.2**: Authentication, Firestore, Storage
- **Firebase Admin**: Server-side Firebase operations
- **Clerk**: User management and session handling

### Payment & Services
- **Razorpay**: Payment gateway integration
- **PDF.js**: PDF processing and preview
- **PDF-lib**: PDF manipulation (rotation, page count)

### PWA & Performance
- **Serwist**: Service worker management
- **Next-PWA**: Progressive Web App features

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   State Store   │    │   Firebase      │    │   Razorpay      │
│   (Zustand)     │    │   (Auth/DB)     │    │   (Payments)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Architecture Principles
- **Mobile-First**: Optimized for mobile devices (max-width: 428px)
- **Component-Based**: Reusable UI components with TypeScript
- **State-Driven**: Centralized state management with Zustand
- **API-First**: RESTful API endpoints for all operations
- **PWA-Ready**: Service worker for offline capabilities

## Core Features

### 1. User Authentication
- **Phone Authentication**: OTP-based login/registration
- **Email Authentication**: Traditional email/password
- **Session Management**: Persistent authentication state
- **User Profiles**: Username, phone, email storage

### 2. Document Management
- **PDF Upload**: Drag-and-drop file interface
- **Page Preview**: Visual PDF preview with navigation
- **Page Rotation**: Individual page rotation (0°, 90°, 180°, 270°)
- **Page Count**: Automatic page detection and display

### 3. Print Configuration
- **Paper Options**: A3, A4 sizes
- **Print Settings**: Single/Double-sided, Black & White/Color
- **Binding Services**: Soft binding, Hard binding, Spiral binding
- **Quantity & Copies**: Multiple copy support
- **Emergency Service**: Priority processing options

### 4. Shop Management
- **Shop Discovery**: Browse available print shops
- **Pricing Tables**: Dynamic pricing based on shop configuration
- **Service Comparison**: Compare services across shops
- **Location-Based**: Shop address and timing information

### 5. Order Processing
- **Cost Calculation**: Real-time pricing based on settings
- **Payment Integration**: Secure Razorpay checkout
- **Order Tracking**: Status updates (pending → processing → completed)
- **History**: User order history and management

## Data Models

### Core Types

```typescript
// Print Configuration
interface PrintSettings {
  paperSize: 'A3' | 'A4';
  printFormat: 'Single-Sided' | 'Double-Sided';
  printColor: 'Black & White' | 'Color';
  orientation: 'Vertical' | 'Horizontal';
  binding?: 'Soft Binding' | 'Spiral Binding' | 'Hard Binding' | '';
  copies: number;
  customMessage?: string;
  vinylColor?: string;
  extraColorPages?: number;
  emergency?: boolean;
}

// Shop Pricing Structure
interface ShopPricing {
  a4: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
  a3: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
  services: {
    softBinding?: number;
    hardBinding?: number;
    emergency?: number;
    spiralBinding?: number;
  };
}

// Shop Information
interface Shop {
  id: string;
  name: string;
  address: string;
  timing?: string;
  logoUrl?: string;
  pricing?: ShopPricing;
}

// Order Document
interface OrderDoc {
  userId: string;
  shopId: string;
  shopName: string;
  userName: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  totalCost: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  timestamp: any; // Firestore Timestamp
  emergency: boolean;
  printSettings: PrintSettings;
  pricingDetails: PricingDetails;
}
```

## Authentication System

### Firebase Authentication
- **Phone Auth**: SMS OTP verification
- **Email Auth**: Email/password authentication
- **Custom Tokens**: Integration with Clerk for user management
- **Session Persistence**: Automatic login state management

### Clerk Integration
- **User Management**: Centralized user data
- **Session Handling**: Secure session management
- **Profile Sync**: Firebase user data synchronization

### Security Features
- **reCAPTCHA**: Bot protection for phone authentication
- **Token Validation**: Secure API endpoint protection
- **Rate Limiting**: OTP request throttling
- **Input Validation**: Zod schema validation

## State Management

### Zustand Stores

#### 1. Auth Store (`authStore.ts`)
```typescript
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  verificationId: string | null;
  recaptchaReady: boolean;
  authFlow: 'login' | 'register' | null;
  
  // Actions
  sendOTP: (phone: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

#### 2. Upload Store (`uploadStore.ts`)
```typescript
interface UploadState {
  file: File | null;
  fileUrl: string | null;
  pageCount: number;
  pageRotations: number[];
  settings: PrintSettings;
  shopPricing?: ShopPricing;
  totalCost: number;
  
  // Actions
  setFile: (file: File | null) => Promise<void>;
  setSettings: (partial: Partial<PrintSettings>) => void;
  rotatePage: (index: number, delta: 90 | -90) => void;
  recalc: () => void;
}
```

#### 3. Pricing Store (`pricingStore.ts`)
- Legacy pricing structure for fallback
- Shop-specific pricing integration
- Dynamic cost calculation

#### 4. Orders Store (`ordersStore.ts`)
- Order history management
- Status tracking
- User order data

#### 5. Shops Store (`shopsStore.ts`)
- Shop data management
- Pricing information
- Location and service details

## API Endpoints

### Authentication Routes
```
POST /api/auth/firebase-custom-token
- Creates Firebase custom token for Clerk users
- Requires Firebase Admin credentials
```

### User Management
```
POST /api/users/upsert
- Creates or updates user profile
- Syncs Clerk user data with Firebase
- Stores username, phone, email
```

### Payment Processing
```
POST /api/razorpay/order
- Creates Razorpay order
- Requires amount, currency, receipt
- Returns order details for checkout

POST /api/razorpay/verify
- Verifies payment signature
- HMAC-SHA256 validation
- Ensures payment authenticity
```

### API Security
- **Authentication**: Clerk-based user verification
- **Validation**: Request body validation
- **Error Handling**: Structured error responses
- **Rate Limiting**: Request throttling (implemented)

## Payment Integration

### Razorpay Setup
1. **Account Creation**: Razorpay business account
2. **API Keys**: Key ID and Secret configuration
3. **Webhook Setup**: Payment status notifications
4. **Test Mode**: Sandbox environment for development

### Payment Flow
1. **Order Creation**: API creates Razorpay order
2. **Checkout**: Frontend Razorpay checkout widget
3. **Payment Processing**: Secure payment gateway
4. **Verification**: Signature validation for security
5. **Order Confirmation**: Success/failure handling

### Security Measures
- **Signature Verification**: HMAC-SHA256 validation
- **Environment Variables**: Secure key storage
- **Server-Side Processing**: No client-side key exposure
- **Amount Validation**: Server-side amount verification

## File Processing

### PDF Handling
- **PDF.js**: Client-side PDF rendering and preview
- **PDF-lib**: Server-side PDF manipulation
- **File Validation**: PDF format verification
- **Size Limits**: Configurable file size restrictions

### Page Management
- **Page Count**: Automatic page detection
- **Rotation Control**: Individual page rotation
- **Preview Generation**: Thumbnail generation
- **Memory Optimization**: Efficient file handling

### Storage Strategy
- **Firebase Storage**: File upload and storage
- **URL Generation**: Secure download URLs
- **Cleanup**: Automatic temporary file cleanup
- **CDN Integration**: Fast file delivery

## UI/UX Design System

### Design Principles
- **Mobile-First**: Optimized for mobile devices
- **Consistent Spacing**: 8px grid system
- **Accessibility**: WCAG compliance
- **Performance**: Fast loading and interactions

### Component Library
- **ShadCN/UI**: Base component system
- **Custom Components**: Platform-specific components
- **Responsive Design**: Adaptive layouts
- **Dark Mode**: Theme support (prepared)

### Layout System
- **Container Width**: Max-width 428px (mobile-optimized)
- **Navigation**: Bottom navigation bar
- **Headers**: Consistent page headers
- **Forms**: Standardized form components

### Typography
- **Quinn Font**: Custom display font for branding
- **Geist Sans**: System font for body text
- **Hierarchy**: Clear text hierarchy
- **Readability**: Optimized for mobile screens

## Service Worker & PWA

### Serwist Integration
- **Service Worker**: Offline functionality
- **Cache Strategy**: Intelligent caching
- **Background Sync**: Offline request queuing
- **Update Management**: App update notifications

### PWA Features
- **Manifest**: App installation support
- **Offline Support**: Cached resources
- **Push Notifications**: User engagement
- **App-like Experience**: Native app feel

### Configuration
```javascript
// next.config.js
const withSerwist = require('@serwist/next').default({
  swSrc: 'service-worker.js',
  swDest: 'public/sw.js'
});
```

## Environment Configuration

### Required Environment Variables

#### Firebase Configuration
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

#### Firebase Admin (Server-side)
```bash
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
```

#### Razorpay Configuration
```bash
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

#### Clerk Configuration
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key
```

### Environment Setup
1. **Development**: `.env.local` file
2. **Production**: Environment variables in hosting platform
3. **Security**: Never commit sensitive keys
4. **Validation**: Runtime environment validation

## Development Setup

### Prerequisites
- **Node.js**: Version 18+ (LTS recommended)
- **npm/yarn**: Package manager
- **Git**: Version control
- **Firebase CLI**: Firebase project management

### Installation Steps
```bash
# Clone repository
git clone <repository-url>
cd Swoop

# Install dependencies
npm install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your credentials

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Development Scripts
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "postinstall": "cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs || true"
}
```

### Code Quality
- **ESLint**: Code linting and formatting
- **TypeScript**: Type checking and validation
- **Prettier**: Code formatting (recommended)
- **Husky**: Git hooks for quality checks

## Deployment

### Build Process
1. **Dependencies**: `npm ci` for production installs
2. **Build**: `npm run build` generates optimized build
3. **Static Assets**: Optimized images, fonts, and bundles
4. **Service Worker**: Generated service worker files

### Deployment Options

#### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Firebase Hosting
```bash
# Install Firebase CLI
npm i -g firebase-tools

# Login and initialize
firebase login
firebase init hosting

# Deploy
firebase deploy
```

#### Other Platforms
- **Netlify**: Static site hosting
- **AWS Amplify**: Full-stack deployment
- **Docker**: Containerized deployment

### Environment Setup
1. **Production Variables**: Set in hosting platform
2. **Domain Configuration**: Custom domain setup
3. **SSL Certificate**: Automatic HTTPS
4. **CDN**: Global content delivery

## Security Considerations

### Authentication Security
- **Phone Verification**: SMS OTP validation
- **reCAPTCHA**: Bot protection
- **Session Management**: Secure session handling
- **Token Validation**: JWT token verification

### API Security
- **Rate Limiting**: Request throttling
- **Input Validation**: Schema validation with Zod
- **CORS**: Cross-origin request handling
- **Error Handling**: Secure error messages

### Data Security
- **Firebase Security Rules**: Database access control
- **File Upload Validation**: File type and size limits
- **Payment Verification**: Cryptographic signature validation
- **Environment Variables**: Secure credential storage

### Privacy Compliance
- **GDPR**: Data protection compliance
- **User Consent**: Clear privacy policies
- **Data Minimization**: Minimal data collection
- **Right to Deletion**: User data removal

## Performance Optimization

### Frontend Optimization
- **Code Splitting**: Dynamic imports for routes
- **Image Optimization**: Next.js image optimization
- **Font Loading**: Optimized font loading with `next/font`
- **Bundle Analysis**: Webpack bundle analysis

### Backend Optimization
- **API Caching**: Response caching strategies
- **Database Indexing**: Firestore query optimization
- **CDN Integration**: Global content delivery
- **Service Worker**: Offline caching

### Monitoring & Analytics
- **Performance Metrics**: Core Web Vitals
- **Error Tracking**: Error monitoring and reporting
- **User Analytics**: User behavior tracking
- **Performance Budgets**: Load time targets

## Testing Strategy

### Testing Levels
- **Unit Tests**: Component and function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user journey testing
- **Performance Tests**: Load and stress testing

### Testing Tools
- **Jest**: Unit testing framework
- **React Testing Library**: Component testing
- **Playwright**: E2E testing
- **Lighthouse**: Performance testing

### Test Coverage
- **Code Coverage**: Minimum 80% coverage
- **Critical Paths**: Essential user flows
- **Edge Cases**: Error handling scenarios
- **Accessibility**: WCAG compliance testing

## Future Enhancements

### Planned Features
- **Multi-language Support**: Internationalization
- **Advanced Analytics**: Business intelligence
- **Mobile App**: React Native application
- **AI Integration**: Smart pricing and recommendations

### Technical Improvements
- **GraphQL**: API query optimization
- **Microservices**: Service architecture
- **Real-time Updates**: WebSocket integration
- **Advanced Caching**: Redis integration

### Business Features
- **Subscription Plans**: Recurring billing
- **Loyalty Program**: User rewards system
- **Partner Integration**: Third-party services
- **Advanced Reporting**: Business analytics

## Conclusion

The Swoop platform represents a comprehensive solution for print service management, combining modern web technologies with robust backend services. The architecture prioritizes user experience, security, and scalability while maintaining code quality and maintainability.

Key strengths include:
- **Mobile-first design** optimized for user engagement
- **Secure authentication** with multiple verification methods
- **Real-time pricing** with dynamic cost calculation
- **Seamless payment** integration with Razorpay
- **Progressive Web App** capabilities for offline use
- **Scalable architecture** built on Firebase infrastructure

This document serves as a complete reference for understanding, developing, and maintaining the Swoop platform. For specific implementation details, refer to the individual component files and API documentation.
