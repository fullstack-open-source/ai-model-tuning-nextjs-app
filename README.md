# AI Model Tuning with Next.js

[![Next.js](https://img.shields.io/badge/Next.js-15.1-black.svg)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.0-purple.svg)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101.svg)](https://socket.io)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)

> **AI Model Tuning with Next.js: A Full-stack Next.js app designed to fine-tune machine learning models**

This repository contains a **Next.js 15 frontend app** for fine-tuning AI models, built with **React 19.2**, **TypeScript**, **Prisma**, and other modern technologies. It is a feature-packed solution designed to handle advanced AI model training workflows, all while providing a sleek and responsive user interface.

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📦 Installation & Setup](#-installation--setup)
- [🚀 Quick Start](#-quick-start)
- [📚 Project Structure](#-project-structure)
- [🎨 Key Features Explained](#-key-features-explained)
- [🔌 API Integration](#-api-integration)
- [📱 Real-time Features](#-real-time-features)
- [📄 License](#-license)

## ✨ Features

### 🎯 Core Capabilities

- **🔐 Advanced Authentication System**
  - JWT authentication with multi-token support
  - OTP verification (Email/SMS/WhatsApp)
  - Secure password management

- **📊 Real-time Dashboard**
  - Live model training statistics
  - Interactive charts and analytics (Line, Bar, Pie)
  - Real-time updates via WebSocket

- **🔧 Model Tuning & Fine-Tuning**
  - Intuitive UI for adjusting hyperparameters
  - Real-time feedback for training progress
  - Easy integration with AI/ML models built in TensorFlow, PyTorch, etc.

- **🌍 Internationalization (i18n)**
  - Full support for English and Arabic languages
  - RTL (Right-to-Left) layout support
  - Dynamic language switching

- **⚙️ Advanced Media Management**
  - Manage datasets and training media
  - Google Cloud Storage integration
  - File upload, optimization, and caching

- **📈 Performance & Optimization**
  - Redis caching for fast API responses
  - Lazy loading for media and components
  - Code-splitting for optimized loading

- **🎨 Modern UI/UX**
  - Built with Tailwind CSS for responsive and modern design
  - Dynamic theme switching (Dark/Light mode)
  - shadcn/ui component library for accessibility

### 🔧 Technical Features

- **Next.js 15.1**: Server-side rendering, App Router, API Routes
- **React 19.2**: Concurrent rendering, hooks, and context API
- **TypeScript 5.0**: Full type safety across the application
- **Prisma ORM**: Type-safe database access with PostgreSQL
- **Socket.io**: Real-time bidirectional communication
- **Tailwind CSS 3.4**: Utility-first CSS framework
- **shadcn/ui**: Beautiful, accessible component library
- **Redis**: Caching and session management
- **Winston**: Professional logging system
- **Recharts**: Beautiful chart library
- **Axios**: HTTP client for API calls



## 🏗️ Architecture

### System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Client Browser                             │
│                    (React 19 + Next.js 15)                    │
└────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Next.js Application                         │
│                    (Port 3000)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Client-Side Features:                                   │  │
│  │  - React Components (Client Components)                  │  │
│  │  - Context Providers (Auth, Theme, i18n, WebSocket)      │  │
│  │  - Hooks (useApiCall, usePermissions, useToast)          │  │
│  │  - Real-time WebSocket Client                            │  │
│  │  - Client-side Caching (Media, Images)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Server-Side Features:                                   │  │
│  │  - API Routes (Next.js API Routes)                       │  │
│  │  - Server Components                                     │  │
│  │  - Database Access (Prisma)                              │  │
│  │  - Redis Caching                                         │  │
│  │  - WebSocket Server (Socket.io)                          │  │
│  │  - Authentication Middleware                             │  │
│  │  - Permission Checking                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬───────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   PostgreSQL Database    │   │   Redis Cache            │
│   (Port 5432)            │   │   (Port 6379)            │
│   - User Data            │   │   - Session Storage      │
│   - Permissions          │   │   - Media Cache          │
│   - Activity Logs        │   │   - API Response Cache   │
│   - Groups               │   │   - Token Blacklist      │
│   - Media                │   │   - Rate Limiting        │
│   - Notifications        │   │                          │
│   - Account Sharing      │   │                          │
└──────────────────────────┘   └──────────────────────────┘
                │
                ▼
┌──────────────────────────┐
│   pgAdmin                │
│   (Port 5050)            │
│   - Database Management  │
│   - Query Interface      │
│   - Visual Schema Editor │
└──────────────────────────┘
                │
                ▼
┌──────────────────────────┐
│   Google Cloud Storage   │
│   (Media & Static Files) │
│   - User Uploads         │
│   - Generated Content    │
│   - Static Assets        │
└──────────────────────────┘
```

### Request Flow

```
1. User Action (Click, Form Submit, etc.)
   │
   ├─► Client Component
   │   ├─► Context (Auth, Theme, i18n)
   │   ├─► Custom Hooks (useApiCall, usePermissions)
   │   └─► API Service Call
   │
   ├─► Next.js API Route (/api/*)
   │   ├─► Authentication Middleware
   │   ├─► Permission Check
   │   ├─► Request Validation
   │   ├─► Business Logic
   │   ├─► Database Operations (Prisma)
   │   ├─► Cache Management (Redis)
   │   ├─► WebSocket Event Emission
   │   └─► Response Formatting
   │
   ├─► WebSocket Update (Real-time)
   │   └─► Client Receives Update
   │       └─► UI Updates Automatically
   │
   └─► Response
       ├─► Success/Error Handling
       ├─► Toast Notification
       └─► UI State Update
```

### Component Architecture

```
App Layout
├── Providers (Auth, Theme, i18n, WebSocket, Toast)
├── MainLayout
│   ├── Navbar (Collapsible, Search, Theme Toggle)
│   ├── Sidebar (Navigation, Appearance Settings)
│   ├── TopNav (User Menu, Notifications)
│   └── Content Area
│       ├── PageGuard (Authentication Check)
│       ├── PermissionGuard (Permission Check)
│       └── Page Content
│           ├── Dashboard (Charts, Statistics)
│           ├── Users (List, Create, Edit, Delete)
│           ├── Media (Library, Upload, Manage)
│           ├── Activity (Logs, Filtering)
│           ├── Settings (Profile, Project, System)
│           └── Admin (Access Control, Analytics)
└── Footer
```

## 🛠️ Tech Stack

### Frontend Framework
- **Next.js 15.1.5**: React framework with App Router
- **React 19.2.0**: UI library with concurrent features
- **TypeScript 5.0**: Type-safe JavaScript

### Styling & UI
- **Tailwind CSS 3.4**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components
- **Lucide React**: Beautiful icon library
- **Recharts 3.5**: Charting library

### State Management & Data
- **React Context API**: Global state management
- **React Hooks**: Custom hooks for data fetching
- **Axios**: HTTP client
- **Prisma Client**: Database ORM

### Real-time & Communication
- **Socket.io Client 4.8**: Real-time WebSocket communication
- **Socket.io Server**: WebSocket server integration

### Caching & Storage
- **Redis 7 (ioredis)**: Server-side caching (included in Docker setup)
- **Client-side Cache**: Media and image caching
- **localStorage**: Client-side persistence
- **Docker Volumes**: Persistent data storage for database and cache

### Authentication & Security
- **JWT (jsonwebtoken)**: Token-based authentication
- **bcryptjs**: Password hashing
- **Session Management**: Secure session handling

### Database & ORM
- **PostgreSQL 16**: Relational database (included in Docker setup)
- **Prisma 7.0**: Next-generation ORM
- **Prisma Client**: Type-safe database access
- **pgAdmin 4**: Database management UI (included in Docker setup)

### Utilities
- **Winston**: Logging system
- **UUID**: Unique identifier generation
- **Class Variance Authority**: Component variants
- **clsx & tailwind-merge**: Conditional class names

## 📦 Installation & Setup

### Prerequisites

**System Requirements:**
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2
- **Docker**: 20.10+ (recommended for easy setup)
- **Docker Compose**: 2.0+ (for multi-container orchestration)
- **Node.js**: 18.0 or higher (for local development without Docker)
- **npm**: 9.0 or higher (for local development without Docker)
- **PostgreSQL**: 16+ (included in Docker setup)
- **Redis**: 7+ (included in Docker setup)

**Development Tools:**
- Git 2.30+
- Code editor (VS Code recommended)
- Postman or similar API testing tool
- Make (optional, for convenient commands)

### Quick Start

#### Option 1: Docker (Recommended - Easiest Setup)

**Step 1: Clone Repository**

```bash
git clone <repository-url>
cd nextjs-frontend-starter
```

**Step 2: Setup Environment**

```bash
# Copy example environment file
cp example.env .env

# Edit .env file with your configuration (optional - defaults work)
nano .env
```

**Step 3: Start All Services with Docker Compose**

```bash
# Using Make (recommended)
make up

# Or using Docker Compose directly
docker compose up -d
```

This will automatically:
- ✅ Start PostgreSQL database
- ✅ Start Redis cache
- ✅ Start Next.js application
- ✅ Start pgAdmin (database management UI)
- ✅ Run database migrations
- ✅ Seed database with default data

**Step 4: Access Application**

- **Application**: http://localhost:3000
- **pgAdmin**: http://localhost:5050
  - Email: `admin@example.com` (or your `PGADMIN_EMAIL`)
  - Password: `admin@123` (or your `PGADMIN_PASSWORD`)
- **Database**: `localhost:5432`
- **Redis**: `localhost:6379`
- **API Routes**: http://localhost:3000/api/*
- **Health Check**: http://localhost:3000/api/health

**Useful Commands:**

```bash
make help           # Show all available commands
make logs           # View all service logs
make logs-app       # View app logs only
make db-shell       # Open PostgreSQL shell
make db-migrate     # Run Prisma migrations
make db-seed        # Seed the database
make shell          # Open app container shell
make down           # Stop all services
make clean          # Stop and remove volumes
```

#### Option 2: Local Development (Without Docker)

**Step 1: Clone Repository**

```bash
git clone <repository-url>
cd nextjs-frontend-starter
```

**Step 2: Install Dependencies**

```bash
npm install
```

**Step 3: Setup Environment**

```bash
# Copy example environment file
cp example.env .env

# Edit .env file with your configuration
nano .env
```

**Required Environment Variables:**

```env
# Application
APP_MODE=development
APP_INTERNAL_PORT=3000

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
API_INTERNAL_URL=http://localhost:3000

# Database (PostgreSQL)
DATABASE_HOST=localhost
DATABASE_NAME=postgres
DATABASE_USER=nextjs_db
DATABASE_PASSWORD=postgres123
DATABASE_PORT=5432
DATABASE_URL=postgresql://nextjs_db:postgres123@localhost:5432/postgres?schema=public

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
REDIS_CACHE_ENABLED=true

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRY_MINUTES=60
SESSION_TOKEN_EXPIRY_MINUTES=10080
REFRESH_TOKEN_EXPIRY_MINUTES=43200

# Storage (Optional - for media uploads)
GOOGLE_STORAGE_BUCKET_NAME=your-bucket-name
STORAGE_BUCKET=your-bucket-name

# Media Access
MEDIA_ENABLE_ACCESS_KEY=true
MEDIA_ACCESS_KEY_LENGTH=32
MEDIA_REQUIRE_ACCESS_KEY_FOR_PUBLIC=false
MEDIA_ALLOW_ADMIN_ACCESS_WITHOUT_KEY=true

# pgAdmin (for Docker setup)
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin@123
PGADMIN_PORT=5050
```

**Step 4: Setup Database**

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Seed database with default data
npm run db:seed
```

**Step 5: Start Development Server**

```bash
# Development mode with hot reload
npm run dev

# Or start production build
npm run build
npm start
```

**Step 6: Access Application**

- **Application**: http://localhost:3000
- **API Routes**: http://localhost:3000/api/*
- **Health Check**: http://localhost:3000/api/health

## 🚀 Quick Start

### Docker Deployment (Recommended)

**Start All Services:**

```bash
# Using Make (recommended)
make up

# Or using Docker Compose directly
docker compose up -d
```

**View Logs:**

```bash
# All services
make logs

# Specific service
make logs-app
make logs-db
make logs-redis
make logs-pgadmin

# Or using Docker Compose
docker compose logs -f
docker compose logs -f app
```

**Database Management:**

```bash
# Open PostgreSQL shell
make db-shell

# Run migrations
make db-migrate

# Seed database
make db-seed

# Open Prisma Studio
make db-studio

# Reset database
make db-reset
```

**Stop Services:**

```bash
# Stop all services
make down

# Stop and remove volumes
make clean

# Or using Docker Compose
docker compose down
docker compose down -v
```

**Access Points:**

- **App**: http://localhost:3000
- **pgAdmin**: http://localhost:5050
- **Database**: localhost:5432
- **Redis**: localhost:6379

### Local Development (Without Docker)

**Development Mode:**

```bash
# Install dependencies
npm install

# Setup environment
cp example.env .env
# Edit .env with your configuration

# Setup database (requires PostgreSQL running)
npm run db:generate
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

**Production Build:**

```bash
# Build application
npm run build

# Start production server
npm start

# Or use PM2
npm run pm2:start
```

### Development with Docker

**Start in Development Mode:**

```bash
# Start with development overrides
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d

# Or using Make
make up-dev
```

This enables:
- Hot-reload for code changes
- Development optimizations
- Easier debugging

## 📚 Project Structure

```
nextjs-frontend-starter/
├── 📁 src/
│   ├── 📁 app/                          # Next.js App Router
│   │   ├── 📁 (auth)/                   # Authentication pages
│   │   │   ├── login/                   # Login page
│   │   │   ├── signup/                  # Signup page
│   │   │   ├── verify/                  # Email/Phone verification
│   │   │   ├── set-password/            # Set password
│   │   │   └── forgot-password/         # Password recovery
│   │   ├── 📁 api/                      # API Routes
│   │   │   ├── auth/                    # Authentication endpoints
│   │   │   ├── users/                   # User management
│   │   │   ├── dashboard/               # Dashboard statistics
│   │   │   ├── media/                   # Media management
│   │   │   ├── activity/                # Activity logs
│   │   │   ├── permissions/             # Permissions & groups
│   │   │   ├── settings/                # User settings
│   │   │   └── notifications/           # Notifications
│   │   ├── 📁 admin/                    # Admin pages
│   │   │   ├── users/                   # User management
│   │   │   ├── access-control/          # Permissions & groups
│   │   │   ├── project-settings/        # Project configuration
│   │   │   └── system-analytics/        # System monitoring
│   │   ├── dashboard/                   # Dashboard page
│   │   ├── media/                       # Media library
│   │   ├── activity/                    # Activity logs
│   │   ├── profile-settings/            # User profile settings
│   │   ├── notifications/               # Notifications page
│   │   ├── layout.tsx                   # Root layout
│   │   └── page.tsx                     # Home page
│   │
│   ├── 📁 components/                    # React Components
│   │   ├── 📁 auth/                     # Authentication components
│   │   │   ├── PageGuard.tsx            # Route protection
│   │   │   └── StatusGuard.tsx          # User status check
│   │   ├── 📁 layout/                   # Layout components
│   │   │   ├── MainLayout.tsx           # Main app layout
│   │   │   ├── Navbar.tsx               # Sidebar navigation
│   │   │   └── TopNav.tsx               # Top navigation bar
│   │   ├── 📁 dashboard/                 # Dashboard components
│   │   │   ├── ChartCard.tsx            # Chart container
│   │   │   ├── LineChart.tsx            # Line chart
│   │   │   ├── BarChart.tsx             # Bar chart
│   │   │   ├── PieChart.tsx             # Pie chart
│   │   │   └── AreaChart.tsx            # Area chart
│   │   ├── 📁 media/                     # Media components
│   │   │   ├── MediaPicker.tsx          # Media selection component
│   │   │   ├── FolderManager.tsx        # Folder management
│   │   │   └── CachedImage.tsx          # Optimized image component
│   │   ├── 📁 ui/                       # shadcn/ui components
│   │   │   ├── button.tsx               # Button component
│   │   │   ├── card.tsx                 # Card component
│   │   │   ├── input.tsx                # Input component
│   │   │   ├── dialog.tsx               # Dialog component
│   │   │   └── ...                      # More UI components
│   │   └── 📁 permissions/               # Permission components
│   │       ├── PermissionGuard.tsx      # Permission check
│   │       └── PermissionButton.tsx     # Permission-based button
│   │
│   ├── 📁 context/                      # React Context Providers
│   │   ├── AuthContext.tsx              # Authentication context
│   │   ├── ThemeContext.tsx             # Theme management
│   │   ├── I18nContext.tsx              # Internationalization
│   │   ├── WebSocketContext.tsx         # WebSocket connection
│   │   └── Provider.tsx                 # Combined providers
│   │
│   ├── 📁 hooks/                         # Custom React Hooks
│   │   ├── useApiCall.ts                # API call hook
│   │   ├── useAuth.ts                   # Authentication hook
│   │   ├── usePermissions.ts            # Permission checking
│   │   ├── useToast.ts                  # Toast notifications
│   │   └── useDebounce.ts               # Debounce utility
│   │
│   ├── 📁 services/                      # API Service Layer
│   │   ├── auth.service.ts              # Authentication service
│   │   ├── user.service.ts              # User service
│   │   ├── media.service.ts             # Media service
│   │   ├── dashboard.service.ts         # Dashboard service
│   │   ├── permission.service.ts        # Permission service
│   │   └── websocket.service.ts         # WebSocket service
│   │
│   ├── 📁 lib/                          # Utility Libraries
│   │   ├── 📁 api/                      # API utilities
│   │   │   ├── ApiService.ts            # API service class
│   │   │   └── ApiServiceFactory.ts    # API factory
│   │   ├── 📁 cache/                     # Caching utilities
│   │   │   ├── cache.ts                # Redis cache
│   │   │   ├── mediaCache.ts           # Media cache
│   │   │   └── imageCache.ts           # Image cache
│   │   ├── 📁 authenticate/             # Auth utilities
│   │   │   ├── helpers.ts              # Auth helpers
│   │   │   └── session-manager.ts      # Session management
│   │   ├── 📁 middleware/               # Middleware
│   │   │   ├── auth.ts                 # Auth middleware
│   │   │   └── permission-check.ts     # Permission middleware
│   │   └── 📁 multilingual/             # i18n utilities
│   │       └── i18n.ts                  # Translation loader
│   │
│   ├── 📁 models/                       # TypeScript Models
│   │   ├── user.model.ts               # User types
│   │   ├── media.model.ts              # Media types
│   │   ├── permission.model.ts          # Permission types
│   │   └── api.model.ts                # API response types
│   │
│   ├── 📁 locales/                      # Translation Files
│   │   ├── 📁 en/                       # English translations
│   │   │   ├── general.json            # General terms
│   │   │   ├── auth.json               # Auth terms
│   │   │   ├── dashboard.json          # Dashboard terms
│   │   │   └── ...                     # More modules
│   │   └── 📁 ar/                       # Arabic translations
│   │       └── ...                     # Same structure
│   │
│   └── 📁 types/                        # TypeScript Types
│       ├── axios.ts                    # Axios types
│       └── cache.d.ts                  # Cache types
│
├── 📁 prisma/                           # Prisma ORM
│   ├── schema.prisma                    # Database schema
│   ├── seed-defaults.js                 # Seed data
│   └── migrations/                     # Database migrations
│
├── 📁 scripts/                          # Helper Scripts
│   ├── init-db.sql                      # PostgreSQL initialization
│   └── pgadmin-servers.json             # pgAdmin server config
│
├── 📁 public/                           # Static Assets
│   └── uploads/                         # Uploaded media (local)
│
├── 📄 server.js                         # Custom Next.js server
├── 📄 start.sh                          # Startup script (auto migrations)
├── 📄 Makefile                          # Docker management commands
├── 📄 next.config.ts                    # Next.js configuration
├── 📄 tailwind.config.js                # Tailwind configuration
├── 📄 tsconfig.json                     # TypeScript configuration
├── 📄 package.json                      # Dependencies
├── 📄 docker-compose.yaml               # Docker Compose config
├── 📄 docker-compose.dev.yaml            # Development override
├── 📄 Dockerfile                        # Docker image
├── 📄 example.env                        # Environment variables template
└── 📄 README.md                         # This file
```

## 🎨 Key Features Explained

### 🔐 Authentication System

**Multi-Token Architecture:**
- **Access Token**: Short-lived (1 hour) for API authentication
- **Session Token**: Medium-lived (7 days) with full user data
- **Refresh Token**: Long-lived (30 days) for token renewal

**Features:**
- Login with password or OTP
- Email/Phone verification
- Password management (set, change, reset)
- Secure session management
- Token rotation on refresh

**Usage Example:**
```typescript
import { useAuth } from "@context/AuthContext"

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />
  }
  
  return <div>Welcome, {user?.email}</div>
}
```

### 📊 Real-time Dashboard

**Features:**
- Live statistics with WebSocket updates
- Interactive charts (Line, Bar, Pie, Area)
- User growth tracking
- Analytics by multiple dimensions
- Real-time data refresh

**WebSocket Integration:**
```typescript
import { useWebSocket } from "@context/WebSocketContext"

function Dashboard() {
  const { onUserCreated, onUserUpdated, onDashboardStatsUpdate } = useWebSocket()
  
  useEffect(() => {
    onUserCreated(() => {
      // Refresh dashboard data
      refreshDashboard()
    })
  }, [])
}
```

### 📁 Media Management

**Features:**
- Google Cloud Storage & Local Storage support
- MediaPicker component for easy selection
- Folder organization
- Public/Private media with access keys
- Image caching and optimization
- Bulk operations

**MediaPicker Usage:**
```typescript
import { MediaPicker } from "@components/media/MediaPicker"

function MyComponent() {
  const [pickerOpen, setPickerOpen] = useState(false)
  
  return (
    <>
      <Button onClick={() => setPickerOpen(true)}>
        Select Media
      </Button>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(media) => {
          // Handle selected media
          console.log(media)
        }}
        mode="image"
        allowUrl={true}
        allowUpload={true}
      />
    </>
  )
}
```

### 🌍 Internationalization

**Features:**
- English and Arabic support
- RTL layout support
- Dynamic language switching
- Module-based translations

**Usage:**
```typescript
import { useModuleI18n } from "@context/I18nContext"

function MyComponent() {
  const { t } = useModuleI18n("general")
  const { t: tAuth } = useModuleI18n("auth")
  
  return (
    <div>
      <h1>{t("welcome")}</h1>
      <button>{tAuth("login")}</button>
    </div>
  )
}
```

### 🔑 Permission System

**Features:**
- Permission-based route guards
- Component-level permission checks
- User group management
- Permission analytics

**Usage:**
```typescript
import { PermissionGuard } from "@components/permissions/PermissionGuard"
import { usePermissions } from "@hooks/usePermissions"

function MyComponent() {
  const { hasPermission } = usePermissions()
  
  return (
    <PermissionGuard requirePermission="manage_users">
      <UserManagementPanel />
    </PermissionGuard>
  )
}
```

## 🔌 API Integration

### API Service

The application uses a centralized API service for all HTTP requests:

```typescript
import { createPublicApiService } from "@lib/api/ApiServiceFactory"

const apiService = createPublicApiService()

// GET request
const response = await apiService.get("/api/users")

// POST request
const response = await apiService.post("/api/users", { name: "John" })

// With authentication
const authApi = createPublicApiService({
  "X-Session-Token": sessionToken
})
```

### Custom Hook for API Calls

```typescript
import { useApiCall } from "@hooks/useApiCall"

function MyComponent() {
  const fetchUsers = useApiCall(
    async () => {
      return await userService.getUsers()
    },
    {
      onSuccess: (data) => {
        console.log("Users loaded:", data)
      },
      onError: (error) => {
        console.error("Error:", error)
      },
      showErrorToast: true,
    }
  )
  
  useEffect(() => {
    fetchUsers.execute()
  }, [])
  
  return (
    <div>
      {fetchUsers.loading && <Loader />}
      {fetchUsers.data && <UserList users={fetchUsers.data} />}
    </div>
  )
}
```

## 📱 Real-time Features

### WebSocket Integration

**Connection:**
```typescript
import { useWebSocket } from "@context/WebSocketContext"

function MyComponent() {
  const { 
    connected,
    subscribeToDashboard,
    onUserCreated,
    onMediaUpdated 
  } = useWebSocket()
  
  useEffect(() => {
    subscribeToDashboard()
    
    onUserCreated((user) => {
      console.log("New user created:", user)
    })
    
    onMediaUpdated((media) => {
      console.log("Media updated:", media)
    })
  }, [])
}
```

**Available Events:**
- `user:created` - New user registered
- `user:updated` - User profile updated
- `user:deleted` - User deleted
- `media:created` - New media uploaded
- `media:updated` - Media updated
- `media:deleted` - Media deleted
- `folder:created` - Folder created
- `folder:updated` - Folder updated
- `folder:deleted` - Folder deleted
- `activity:new` - New activity log
- `dashboard:stats:update` - Dashboard statistics updated

## 🎯 Usage Examples

### Creating a New Page

```typescript
"use client"

import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { PermissionGuard } from "@components/permissions/PermissionGuard"

export default function MyPage() {
  return (
    <PageGuard requireAuth>
      <PermissionGuard requirePermission="view_my_feature">
        <MainLayout
          title="My Page"
          description="Page description"
        >
          <div>
            {/* Your page content */}
          </div>
        </MainLayout>
      </PermissionGuard>
    </PageGuard>
  )
}
```

### Using MediaPicker in Forms

```typescript
import { MediaPicker } from "@components/media/MediaPicker"
import { useState } from "react"

function ProfileForm() {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  
  return (
    <>
      <Input 
        value={logoUrl}
        placeholder="Logo URL"
      />
      <Button onClick={() => setMediaPickerOpen(true)}>
        Select Logo
      </Button>
      
      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(media) => {
          const url = typeof media === 'string' 
            ? media 
            : media.public_url
          setLogoUrl(url)
          setMediaPickerOpen(false)
        }}
        mode="image"
      />
    </>
  )
}
```

### Using Toast Notifications

```typescript
import { useToast } from "@hooks/useToast"

function MyComponent() {
  const { showSuccess, showError, showInfo } = useToast()
  
  const handleSave = async () => {
    try {
      await saveData()
      showSuccess("Data saved successfully!")
    } catch (error) {
      showError("Failed to save data")
    }
  }
}
```

## 🐳 Docker Deployment

### Docker Compose Services

The project includes a complete Docker Compose setup with all required services:

**Services:**
- **app**: Next.js application (Port 3000)
- **postgres**: PostgreSQL 16 database (Port 5432)
- **redis**: Redis 7 cache (Port 6379)
- **pgadmin**: Database management UI (Port 5050)
- **nginx**: Reverse proxy (Port 9080, optional)

### Quick Start with Docker

```bash
# Start all services
make up
# or
docker compose up -d

# View logs
make logs
# or
docker compose logs -f

# Stop services
make down
# or
docker compose down
```

### Docker Compose Configuration

The `docker-compose.yaml` includes:

- **Automatic database migrations** on startup
- **Database seeding** with default data
- **Health checks** for all services
- **Volume persistence** for data
- **Network isolation** for security
- **Resource limits** for production

### Environment Variables

Key environment variables for Docker:

```env
# Database (auto-configured for Docker)
DATABASE_HOST=postgres
DATABASE_NAME=postgres
DATABASE_USER=nextjs_db
DATABASE_PASSWORD=postgres123
DATABASE_PORT=5432
DATABASE_URL=postgresql://nextjs_db:postgres123@postgres:5432/postgres?schema=public

# Redis (auto-configured for Docker)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

# pgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin@123
PGADMIN_PORT=5050

# Migration & Seed settings
WAIT_FOR_DB=true
DB_WAIT_TIMEOUT=60
SKIP_MIGRATIONS=false
SKIP_SEED=false
```

### Database Management with pgAdmin

**Access pgAdmin:**
1. Open http://localhost:5050
2. Login with:
   - Email: `admin@example.com` (or your `PGADMIN_EMAIL`)
   - Password: `admin@123` (or your `PGADMIN_PASSWORD`)

**Connect to Database:**
- The database server is pre-configured in pgAdmin
- Server name: "Next.js Frontend DB"
- Host: `postgres` (internal Docker network)
- Port: `5432`
- Username: `nextjs_db` (or your `DATABASE_USER`)
- Password: `postgres123` (or your `DATABASE_PASSWORD`)

### Build and Deploy

**Build Docker Image:**

```bash
# Build image
make build
# or
docker compose build

# Build for production (no cache)
make prod-build
```

**Deploy to Production:**

```bash
# Pull latest images and deploy
make prod-deploy
# or
docker compose pull
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

**View Service Status:**

```bash
# Check container status
make status
# or
docker compose ps

# Check health
make health
```

### Development with Docker

**Start in Development Mode:**

```bash
# With hot-reload and development optimizations
make up-dev
# or
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d
```

**Access Container Shell:**

```bash
# App container
make shell
# or
docker compose exec app sh

# PostgreSQL container
make shell-postgres
# or
docker compose exec postgres sh

# Redis container
make shell-redis
# or
docker compose exec redis sh
```

### Database Operations

**Run Migrations:**

```bash
# Production migrations
make db-migrate
# or
docker compose exec app npx prisma migrate deploy

# Development migrations
make db-migrate-dev
# or
docker compose exec app npx prisma migrate dev
```

**Seed Database:**

```bash
make db-seed
# or
docker compose exec app npx prisma db seed
```

**Open Prisma Studio:**

```bash
make db-studio
# or
docker compose exec app npx prisma studio
```

**Reset Database:**

```bash
make db-reset
# or
docker compose exec app npx prisma migrate reset --force
```

### Cleanup

**Stop and Remove:**

```bash
# Stop services
make down

# Stop and remove volumes (clean slate)
make clean

# Remove images
make clean-images

# Full cleanup (prune everything)
make prune
```

### Automatic Database Setup

The `start.sh` script automatically handles database setup on container startup:

**Features:**
- ✅ **Waits for database** to be ready (configurable timeout)
- ✅ **Runs Prisma migrations** automatically
- ✅ **Seeds database** with default data (if empty)
- ✅ **Generates Prisma Client** if needed
- ✅ **Handles errors** gracefully with retries

**Environment Variables:**

```env
# Database wait settings
WAIT_FOR_DB=true              # Wait for database (default: true)
DB_WAIT_TIMEOUT=60            # Wait timeout in seconds (default: 60)

# Migration & seed settings
SKIP_MIGRATIONS=false         # Skip migrations (default: false)
SKIP_SEED=false               # Skip seeding (default: false)
FORCE_SEED=false              # Force seed even if data exists (default: false)
```

**Manual Control:**

```bash
# Skip migrations on startup
SKIP_MIGRATIONS=true docker compose up -d

# Skip seeding on startup
SKIP_SEED=true docker compose up -d

# Force seed even if data exists
FORCE_SEED=true docker compose up -d
```

### Production Deployment

**Recommended Production Setup:**

1. **Use external PostgreSQL** (managed database service)
2. **Use external Redis** (managed cache service)
3. **Configure environment variables** for production
4. **Enable Nginx reverse proxy** (optional)
5. **Set up SSL/TLS** certificates
6. **Configure backups** for database
7. **Set up monitoring** and logging

**Start with Nginx:**

```bash
make up-nginx
# or
docker compose --profile with-nginx up -d
```

### Database Connection

**From Host Machine:**

```bash
# Connect to PostgreSQL
psql -h localhost -p 5432 -U nextjs_db -d postgres

# Or using Docker
docker compose exec postgres psql -U nextjs_db -d postgres
```

**Connection String:**

```
postgresql://nextjs_db:postgres123@localhost:5432/postgres
```

**From Application (Docker Network):**

```
postgresql://nextjs_db:postgres123@postgres:5432/postgres
```

## 📝 Available Scripts

### NPM Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio
npm run db:migrate       # Run migrations

# PM2 (Process Manager)
npm run pm2:start        # Start with PM2
npm run pm2:stop         # Stop PM2 process
npm run pm2:restart      # Restart PM2 process
npm run pm2:logs         # View PM2 logs

# Linting & Formatting
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### Make Commands (Docker Management)

The project includes a comprehensive `Makefile` for convenient Docker management:

```bash
# Docker Commands
make build               # Build Docker images
make up                  # Start all services
make up-dev              # Start in development mode
make up-nginx            # Start with Nginx reverse proxy
make down                # Stop all services
make restart             # Restart all services
make logs                # View all service logs
make logs-app            # View app logs only
make logs-db             # View database logs only
make logs-redis          # View Redis logs only
make logs-pgadmin        # View pgAdmin logs only

# Database Commands
make db-shell            # Open PostgreSQL shell
make db-migrate          # Run Prisma migrations
make db-migrate-dev      # Run development migrations
make db-seed             # Seed the database
make db-reset            # Reset database (migrate + seed)
make db-studio           # Open Prisma Studio
make db-generate         # Generate Prisma Client
make db-push             # Push schema to database

# Utility Commands
make shell               # Open bash shell in app container
make shell-postgres      # Open shell in postgres container
make shell-redis         # Open shell in redis container
make status              # Show container status
make health              # Check service health

# Cleanup Commands
make clean               # Stop services and remove volumes
make clean-images        # Remove Docker images
make prune               # Clean up all Docker resources

# Development Commands
make dev                 # Start local development server
make install             # Install dependencies
make lint                # Run linter
make format              # Format code

# Production Commands
make prod-build          # Build for production (no cache)
make prod-up             # Start production services
make prod-deploy         # Deploy to production

# Help
make help                # Show all available commands
```

**Quick Reference:**

| Command | Description |
|---------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make logs` | View logs |
| `make db-shell` | Open database shell |
| `make db-migrate` | Run migrations |
| `make shell` | Open app container |
| `make clean` | Clean up everything |

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable salt rounds
- **Token Blacklisting**: Redis-based token invalidation
- **Permission Guards**: Route and component-level protection
- **Input Validation**: Server-side validation for all inputs
- **CORS Protection**: Configurable CORS origins
- **Rate Limiting**: Request throttling (via backend)
- **Secure Headers**: Helmet.js security headers
- **Media Access Control**: Access keys for private media

## 🎨 Theming

The application supports three theme modes:

- **Light Mode**: Bright, clean interface
- **Dark Mode**: Dark, eye-friendly interface
- **System Mode**: Automatically follows system preference

**Theme Switching:**
```typescript
import { useTheme } from "@context/ThemeContext"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="dynamic">System</option>
    </select>
  )
}
```

## 📊 Performance Optimizations

- **Image Optimization**: Next.js Image component with caching
- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Dynamic imports for heavy components
- **Client-side Caching**: Media and image caching
- **Server-side Caching**: Redis caching for API responses
- **Optimistic Updates**: Immediate UI updates with background sync
- **Debouncing**: Debounced search and input handlers
- **Memoization**: React.memo and useMemo for expensive computations

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage
```

## 🔧 Troubleshooting

### Docker Issues

**Services won't start:**

```bash
# Check if ports are already in use
netstat -tulpn | grep -E '3000|5432|6379|5050'

# Stop conflicting services or change ports in .env
```

**Database connection errors:**

```bash
# Check if database is ready
make health
# or
docker compose exec postgres pg_isready -U postgres

# View database logs
make logs-db
```

**Migrations failing:**

```bash
# Reset database and try again
make db-reset

# Or manually run migrations
make db-migrate
```

**Volume permission issues:**

```bash
# Fix permissions
sudo chown -R $USER:$USER ./volumes
```

**Container won't start:**

```bash
# Check logs
make logs

# Rebuild containers
make clean
make build
make up
```

### Database Issues

**Can't connect to database:**

1. Check if PostgreSQL container is running: `docker compose ps`
2. Verify environment variables in `.env`
3. Check database logs: `make logs-db`
4. Try connecting manually: `make db-shell`

**Migrations not running:**

1. Check `SKIP_MIGRATIONS` environment variable
2. Manually run: `make db-migrate`
3. Check Prisma schema: `npx prisma validate`

**Seed data not loading:**

1. Check if database is empty: `make db-shell` then `SELECT COUNT(*) FROM "User";`
2. Force seed: `FORCE_SEED=true docker compose up -d`
3. Manually seed: `make db-seed`

### pgAdmin Issues

**Can't access pgAdmin:**

1. Check if pgAdmin is running: `docker compose ps pgadmin`
2. Verify port 5050 is not in use
3. Check logs: `make logs-pgadmin`
4. Verify credentials in `.env` file

**Can't connect to database in pgAdmin:**

1. Use `postgres` as hostname (Docker network)
2. Port: `5432`
3. Username: `postgres` (or your `DATABASE_USER`)
4. Password: `postgres123` (or your `DATABASE_PASSWORD`)

### Redis Issues

**Redis connection errors:**

```bash
# Check if Redis is running
docker compose ps redis

# Test Redis connection
docker compose exec redis redis-cli ping

# View Redis logs
make logs-redis
```

### Application Issues

**App won't start:**

1. Check logs: `make logs-app`
2. Verify environment variables
3. Check database connection
4. Rebuild: `make clean && make build && make up`

**Build errors:**

```bash
# Clean build
make clean
make build

# Check for TypeScript errors
npm run lint
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with amazing open-source technologies:

- **[Next.js](https://nextjs.org/)** - React framework
- **[React](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Prisma](https://www.prisma.io/)** - Database ORM
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Redis](https://redis.io/)** - In-memory data store
- **[Docker](https://www.docker.com/)** - Containerization platform
- **[Tailwind CSS](https://tailwindcss.com/)** - CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Component library
- **[Socket.io](https://socket.io/)** - Real-time communication
- **[Recharts](https://recharts.org/)** - Chart library

---

**Made with ❤️ using modern web technologies**

*This project is free to use, modify, and distribute for any purpose without restrictions.*
