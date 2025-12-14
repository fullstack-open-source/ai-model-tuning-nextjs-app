"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useModuleI18n } from "@context/I18nContext"
import { Button } from "@components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { FrontendFooter } from "@components/footer/FrontendFooter"
import { 
  ArrowRight, Shield, Zap, Users, BarChart3, Lock, Globe, Sparkles,
  Database, Server, Layout, FileCode, Folder, FolderTree, Network,
  Key, Bell, Mail, Phone, Settings, Activity, Share2, Image,
  Code2, Layers, GitBranch, Terminal, CheckCircle2, Cpu, Cloud,
  Box, Workflow, RefreshCw, Eye, PanelLeft, FileJson
} from "lucide-react"

// Feature categories
const featureCategories = [
  {
    category: "Authentication & Security",
    icon: Shield,
    color: "text-green-500",
    features: [
      { name: "JWT Authentication", desc: "Access & refresh tokens with session management" },
      { name: "Session Tokens", desc: "Secure session-based authentication" },
      { name: "Password Hashing", desc: "Bcrypt encryption for secure passwords" },
      { name: "Email Verification", desc: "OTP-based email verification flow" },
      { name: "Phone Verification", desc: "SMS OTP verification via Twilio" },
      { name: "Password Reset", desc: "Secure forgot password flow" },
      { name: "Rate Limiting", desc: "API protection against abuse" },
      { name: "CORS Configuration", desc: "Cross-origin resource sharing setup" },
    ]
  },
  {
    category: "User Management",
    icon: Users,
    color: "text-blue-500",
    features: [
      { name: "User CRUD", desc: "Complete user management operations" },
      { name: "Profile Management", desc: "User profile with avatar upload" },
      { name: "Role-Based Access", desc: "Groups & permissions system" },
      { name: "Permission Guards", desc: "Route & component protection" },
      { name: "User Status", desc: "Active, inactive, suspended states" },
      { name: "Activity Logging", desc: "Track all user actions" },
      { name: "Account Sharing", desc: "Share account access with others" },
      { name: "Invitation System", desc: "Invite users via email" },
    ]
  },
  {
    category: "Real-time & Notifications",
    icon: Bell,
    color: "text-yellow-500",
    features: [
      { name: "WebSocket Server", desc: "Socket.io integration for real-time" },
      { name: "Live Notifications", desc: "Push notifications to users" },
      { name: "Dashboard Updates", desc: "Real-time stats refresh" },
      { name: "Event Broadcasting", desc: "Emit events to specific users/rooms" },
      { name: "Email Notifications", desc: "Nodemailer with templates" },
      { name: "SMS Notifications", desc: "Twilio SMS integration" },
      { name: "Notification Center", desc: "In-app notification management" },
      { name: "Read/Unread Status", desc: "Track notification states" },
    ]
  },
  {
    category: "Media & Storage",
    icon: Image,
    color: "text-purple-500",
    features: [
      { name: "File Upload", desc: "Multi-file upload with progress" },
      { name: "Image Processing", desc: "Resize, compress, thumbnail" },
      { name: "Folder Management", desc: "Organize media in folders" },
      { name: "Local Storage", desc: "File system storage" },
      { name: "Cloud Storage", desc: "S3-compatible storage ready" },
      { name: "Media Statistics", desc: "Storage usage & analytics" },
      { name: "Access Control", desc: "Public/private media" },
      { name: "Bulk Operations", desc: "Move, delete multiple files" },
    ]
  },
  {
    category: "Dashboard & Analytics",
    icon: BarChart3,
    color: "text-cyan-500",
    features: [
      { name: "Admin Dashboard", desc: "Complete admin overview" },
      { name: "User Statistics", desc: "Growth, status, verification" },
      { name: "Activity Charts", desc: "Visual activity tracking" },
      { name: "Real-time Updates", desc: "Live dashboard refresh" },
      { name: "Permission-based Views", desc: "Show data by access level" },
      { name: "Export Reports", desc: "Download statistics" },
      { name: "Custom Widgets", desc: "Modular dashboard components" },
      { name: "Date Range Filters", desc: "Time-based analytics" },
    ]
  },
  {
    category: "Internationalization",
    icon: Globe,
    color: "text-indigo-500",
    features: [
      { name: "Multi-language", desc: "English & Arabic support" },
      { name: "RTL Support", desc: "Right-to-left layout" },
      { name: "Dynamic Loading", desc: "Lazy load translations" },
      { name: "Module-based", desc: "Split translations by feature" },
      { name: "Language Switcher", desc: "Easy language toggle" },
      { name: "Persist Preference", desc: "Remember user choice" },
      { name: "Date Formatting", desc: "Locale-aware dates" },
      { name: "Number Formatting", desc: "Locale-aware numbers" },
    ]
  },
]

// Tech stack
const techStack = {
  frontend: [
    { name: "Next.js 16", desc: "React framework with App Router", icon: "⚡" },
    { name: "React 19", desc: "Latest React with Server Components", icon: "⚛️" },
    { name: "TypeScript 5", desc: "Type-safe development", icon: "📘" },
    { name: "Tailwind CSS 3", desc: "Utility-first styling", icon: "🎨" },
    { name: "Radix UI", desc: "Accessible component primitives", icon: "🧩" },
    { name: "Lucide Icons", desc: "Beautiful icon library", icon: "✨" },
    { name: "Recharts", desc: "Composable chart library", icon: "📊" },
    { name: "React Compiler", desc: "Automatic optimization", icon: "🚀" },
  ],
  backend: [
    { name: "Next.js API Routes", desc: "Serverless API endpoints", icon: "🔌" },
    { name: "Prisma 7", desc: "Type-safe ORM", icon: "💎" },
    { name: "PostgreSQL", desc: "Robust relational database", icon: "🐘" },
    { name: "Redis", desc: "In-memory caching", icon: "🔴" },
    { name: "Socket.io", desc: "Real-time WebSocket server", icon: "🔗" },
    { name: "JWT", desc: "JSON Web Tokens", icon: "🔐" },
    { name: "Bcrypt", desc: "Password hashing", icon: "🔒" },
    { name: "Winston", desc: "Logging framework", icon: "📝" },
  ],
  services: [
    { name: "Nodemailer", desc: "Email sending", icon: "📧" },
    { name: "Twilio", desc: "SMS notifications", icon: "📱" },
    { name: "PM2", desc: "Process management", icon: "⚙️" },
    { name: "Docker", desc: "Containerization", icon: "🐳" },
    { name: "Nginx", desc: "Reverse proxy", icon: "🌐" },
    { name: "ESLint", desc: "Code linting", icon: "🔍" },
    { name: "Turbopack", desc: "Fast bundler", icon: "⚡" },
    { name: "Axios", desc: "HTTP client", icon: "📡" },
  ],
}

// Folder structure with enhanced details
const folderStructure = {
  root: {
    title: "📁 Project Root Structure",
    description: "Complete project layout with all configuration files",
    content: `nextjs-frontend-starter/
│
├── 📁 prisma/                          # 🗄️  DATABASE LAYER
│   ├── schema.prisma                   # Prisma schema (models, relations)
│   ├── migrations/                     # Database migration history
│   └── seed-defaults.js                # Seed admin user & permissions
│
├── 📁 public/                          # 📦 STATIC ASSETS
│   ├── uploads/                        # User uploaded files storage
│   │   ├── media/                      # Media files (images, docs)
│   │   └── avatars/                    # User profile pictures
│   └── locales/                        # 🌍 Translation JSON files
│       ├── en/                         # English translations
│       └── ar/                         # Arabic translations (RTL)
│
├── 📁 src/                             # 💻 SOURCE CODE
│   ├── app/                            # Next.js App Router (pages)
│   ├── components/                     # Reusable React components
│   ├── context/                        # React Context providers
│   ├── hooks/                          # Custom React hooks
│   ├── lib/                            # Utilities & configurations
│   ├── models/                         # TypeScript type definitions
│   └── services/                       # API service classes
│
├── 📁 logs/                            # 📝 APPLICATION LOGS
│   ├── app-YYYY-MM-DD.log              # Daily rotating logs
│   └── error-YYYY-MM-DD.log            # Error-only logs
│
├── ⚙️  server.js                        # Custom server (Socket.io + HTTP)
├── ⚙️  next.config.ts                   # Next.js configuration
├── ⚙️  tailwind.config.js               # Tailwind CSS config
├── ⚙️  tsconfig.json                    # TypeScript configuration
├── ⚙️  prisma.config.ts                 # Prisma client config
├── ⚙️  eslint.config.mjs                # ESLint rules
├── ⚙️  postcss.config.mjs               # PostCSS plugins
├── 📋 package.json                      # Dependencies & scripts
├── 📋 example.env                       # Environment template
├── 🐳 Dockerfile                        # Docker containerization
├── 🐳 .dockerignore                     # Docker ignore rules
└── 🚀 ecosystem.config.js               # PM2 process config`
  },

  src: {
    title: "📁 Source Code Structure",
    description: "Main application source code organization",
    content: `src/
│
├── 📁 app/                              # 🌐 NEXT.JS APP ROUTER
│   │
│   ├── 📁 api/                          # API Route Handlers
│   │   ├── auth/                        # Authentication endpoints
│   │   ├── users/                       # User management
│   │   ├── groups/                      # Role/group management
│   │   ├── permissions/                 # Permission management
│   │   ├── media/                       # File upload & management
│   │   ├── notifications/               # Notification system
│   │   ├── dashboard/                   # Dashboard statistics
│   │   ├── activity/                    # Activity logging
│   │   ├── account-shares/              # Account sharing
│   │   └── project/                     # Project settings
│   │
│   ├── 📁 (auth)/                       # 🔐 Auth Pages (grouped)
│   │   ├── login/page.tsx               # Login page
│   │   ├── signup/page.tsx              # Registration page
│   │   ├── forgot-password/page.tsx     # Password reset
│   │   └── verify-email/page.tsx        # Email verification
│   │
│   ├── 📁 dashboard/                    # 📊 Dashboard Page
│   │   └── page.tsx                     # Admin dashboard
│   │
│   ├── 📁 profile-settings/             # ⚙️  Profile & Settings
│   │   └── page.tsx                     # User settings page
│   │
│   ├── 📁 activity/                     # 📋 Activity Log Page
│   │   └── page.tsx                     # Activity history
│   │
│   ├── layout.tsx                       # Root layout (providers)
│   ├── page.tsx                         # Home page (this page!)
│   └── globals.css                      # Global styles
│
├── 📁 components/                       # 🧩 REACT COMPONENTS
│   ├── ui/                              # Base UI (shadcn/ui)
│   ├── layout/                          # Layout components
│   ├── auth/                            # Auth components
│   ├── dashboard/                       # Dashboard widgets
│   ├── permissions/                     # Permission guards
│   ├── footer/                          # Footer components
│   └── providers/                       # Context providers
│
├── 📁 context/                          # 🔄 REACT CONTEXTS
│   ├── AuthContext.tsx                  # Authentication state
│   ├── ThemeContext.tsx                 # Theme management
│   ├── I18nContext.tsx                  # Internationalization
│   ├── ProjectContext.tsx               # Project settings
│   ├── WebSocketContext.tsx             # Socket.io client
│   └── Provider.tsx                     # Combined providers
│
├── 📁 hooks/                            # 🪝 CUSTOM HOOKS
│   ├── useApiCall.ts                    # API call wrapper
│   ├── usePermissions.ts                # Permission checks
│   └── useDebounce.ts                   # Debounce utility
│
├── 📁 lib/                              # 🛠️  UTILITIES
│   ├── api/                             # API service layer
│   ├── cache/                           # Caching (Redis/Memory)
│   ├── config/                          # Environment config
│   ├── logger/                          # Winston logger
│   ├── middleware/                      # Auth & permission middleware
│   ├── response/                        # Standard API responses
│   ├── multilingual/                    # i18n utilities
│   └── utils/                           # Helper functions
│
├── 📁 models/                           # 📝 TYPE DEFINITIONS
│   ├── user.model.ts                    # User types
│   ├── api.model.ts                     # API response types
│   ├── notification.model.ts            # Notification types
│   └── project.model.ts                 # Project types
│
└── 📁 services/                         # 🔌 API SERVICES
    ├── auth.service.ts                  # Auth API calls
    ├── user.service.ts                  # User API calls
    ├── permission.service.ts            # Permission API calls
    ├── media.service.ts                 # Media API calls
    ├── notification.service.ts          # Notification API calls
    ├── dashboard.service.ts             # Dashboard API calls
    └── profile.service.ts               # Profile API calls`
  },

  api: {
    title: "📁 API Routes Structure",
    description: "All backend API endpoints organized by feature",
    content: `src/app/api/
│
├── 📁 auth/                             # 🔐 AUTHENTICATION
│   ├── login/
│   │   └── route.ts                     # POST   /api/auth/login
│   ├── signup/
│   │   └── route.ts                     # POST   /api/auth/signup
│   ├── logout/
│   │   └── route.ts                     # POST   /api/auth/logout
│   ├── refresh/
│   │   └── route.ts                     # POST   /api/auth/refresh
│   ├── forgot-password/
│   │   └── route.ts                     # POST   /api/auth/forgot-password
│   ├── reset-password/
│   │   └── route.ts                     # POST   /api/auth/reset-password
│   ├── verify-email/
│   │   └── route.ts                     # POST   /api/auth/verify-email
│   ├── verify-phone/
│   │   └── route.ts                     # POST   /api/auth/verify-phone
│   ├── send-otp/
│   │   └── route.ts                     # POST   /api/auth/send-otp
│   └── token-info/
│       └── route.ts                     # GET    /api/auth/token-info
│
├── 📁 users/                            # 👥 USER MANAGEMENT
│   ├── route.ts                         # GET    /api/users (list)
│   │                                    # POST   /api/users (create)
│   └── [user_id]/
│       └── route.ts                     # GET    /api/users/:id
│                                        # PUT    /api/users/:id
│                                        # DELETE /api/users/:id
│
├── 📁 groups/                           # 👔 ROLE MANAGEMENT
│   ├── route.ts                         # GET, POST /api/groups
│   └── [group_id]/
│       ├── route.ts                     # GET, PUT, DELETE
│       └── permissions/
│           └── route.ts                 # Manage group permissions
│
├── 📁 permissions/                      # 🔑 PERMISSION MANAGEMENT
│   ├── route.ts                         # GET, POST /api/permissions
│   ├── my-permissions/
│   │   └── route.ts                     # GET current user permissions
│   └── my-groups/
│       └── route.ts                     # GET current user groups
│
├── 📁 media/                            # 🖼️  MEDIA MANAGEMENT
│   ├── route.ts                         # GET    /api/media (list)
│   ├── upload/
│   │   └── route.ts                     # POST   /api/media/upload
│   ├── folders/
│   │   └── route.ts                     # GET, POST /api/media/folders
│   ├── statistics/
│   │   └── route.ts                     # GET    /api/media/statistics
│   └── [media_id]/
│       ├── route.ts                     # GET, PUT, DELETE
│       └── access/
│           └── route.ts                 # Generate access URL
│
├── 📁 notifications/                    # 🔔 NOTIFICATIONS
│   ├── route.ts                         # GET    /api/notifications
│   ├── [id]/
│   │   └── route.ts                     # GET, PUT /api/notifications/:id
│   └── mark-read/
│       └── route.ts                     # POST   Mark as read
│
├── 📁 dashboard/                        # 📊 DASHBOARD APIs
│   ├── overview/
│   │   └── route.ts                     # GET    User stats overview
│   ├── all-statistics/
│   │   └── route.ts                     # GET    All dashboard stats
│   ├── user-growth/
│   │   └── route.ts                     # GET    User growth data
│   ├── users-by-status/
│   │   └── route.ts                     # GET    Users grouped by status
│   └── notifications-stats/
│       └── route.ts                     # GET    Notification statistics
│
├── 📁 activity/                         # 📋 ACTIVITY LOGGING
│   ├── logs/
│   │   └── route.ts                     # GET    Activity logs
│   └── my-activity/
│       └── route.ts                     # GET    Current user activity
│
├── 📁 account-shares/                   # 🤝 ACCOUNT SHARING
│   ├── route.ts                         # GET, POST account shares
│   ├── invitations/
│   │   └── route.ts                     # Manage invitations
│   └── activity/
│       └── route.ts                     # Share activity log
│
├── 📁 project/                          # ⚙️  PROJECT SETTINGS
│   └── information/
│       └── route.ts                     # GET, PUT project info
│
└── 📁 settings/                         # 🔧 USER SETTINGS
    └── update-theme/
        └── route.ts                     # POST   Update theme`
  },

  components: {
    title: "📁 Components Structure",
    description: "Reusable React components organized by category",
    content: `src/components/
│
├── 📁 ui/                               # 🎨 BASE UI COMPONENTS (shadcn/ui)
│   ├── button.tsx                       # Button with variants
│   ├── card.tsx                         # Card container
│   ├── input.tsx                        # Text input field
│   ├── label.tsx                        # Form label
│   ├── dialog.tsx                       # Modal dialog
│   ├── dropdown-menu.tsx                # Dropdown menus
│   ├── select.tsx                       # Select dropdown
│   ├── tabs.tsx                         # Tab navigation
│   ├── toast.tsx                        # Toast notification
│   ├── toaster.tsx                      # Toast container
│   ├── separator.tsx                    # Visual separator
│   └── slot.tsx                         # Slot component
│
├── 📁 layout/                           # 📐 LAYOUT COMPONENTS
│   ├── MainLayout.tsx                   # App shell with sidebar
│   ├── Navbar.tsx                       # Top navigation bar
│   │   ├── User menu dropdown
│   │   ├── Theme toggle
│   │   ├── Language switcher
│   │   └── Notification bell
│   └── Sidebar.tsx                      # Side navigation
│       ├── Navigation links
│       ├── Permission-based items
│       └── Collapsible groups
│
├── 📁 auth/                             # 🔐 AUTH COMPONENTS
│   ├── PageGuard.tsx                    # Protected route wrapper
│   │   └── Redirects if not logged in
│   ├── StatusGuard.tsx                  # User status checker
│   │   └── Handles suspended/inactive
│   └── LoginForm.tsx                    # Login form component
│
├── 📁 dashboard/                        # 📊 DASHBOARD COMPONENTS
│   ├── ChartCard.tsx                    # Chart wrapper card
│   ├── LineChart.tsx                    # Line chart (Recharts)
│   ├── BarChart.tsx                     # Bar chart (Recharts)
│   ├── PieChart.tsx                     # Pie chart (Recharts)
│   └── StatCard.tsx                     # Statistics card
│
├── 📁 permissions/                      # 🔑 PERMISSION COMPONENTS
│   └── PermissionGuard.tsx              # Conditional render by permission
│       ├── Check single permission
│       ├── Check multiple (AND/OR)
│       └── Admin/SuperAdmin shortcuts
│
├── 📁 footer/                           # 🦶 FOOTER COMPONENTS
│   └── FrontendFooter.tsx               # Public page footer
│
└── 📁 providers/                        # 🔄 PROVIDER COMPONENTS
    └── ToastProvider.tsx                # Toast notification context`
  },

  lib: {
    title: "📁 Library & Utilities",
    description: "Core utilities, configurations, and helper functions",
    content: `src/lib/
│
├── 📁 api/                              # 🔌 API SERVICE LAYER
│   ├── ApiService.ts                    # Base API service class
│   │   ├── GET, POST, PUT, DELETE
│   │   ├── Error handling
│   │   └── Response parsing
│   ├── ApiServiceFactory.ts             # Factory to create instances
│   │   ├── Public API (no auth)
│   │   └── Authenticated API
│   └── getApiUrl.ts                     # URL helper functions
│       ├── getApiEndpoint()
│       └── getBaseUrl()
│
├── 📁 cache/                            # 💾 CACHING LAYER
│   ├── cache.ts                         # Cache interface & factory
│   │   └── Auto-select Redis or Memory
│   ├── memory.ts                        # In-memory cache (Map)
│   │   └── For development/single instance
│   ├── redis.ts                         # Redis cache client
│   │   └── For production/multi instance
│   └── keys.ts                          # Cache key generators
│       ├── getUserCacheKey()
│       ├── getPermissionCacheKey()
│       └── getProjectCacheKey()
│
├── 📁 config/                           # ⚙️  CONFIGURATION
│   └── env.ts                           # Environment variables
│       ├── Database config
│       ├── JWT config
│       ├── Redis config
│       ├── Email config (SMTP)
│       ├── SMS config (Twilio)
│       └── Feature flags
│
├── 📁 db/                               # 🗄️  DATABASE
│   └── prisma.ts                        # Prisma client singleton
│       └── Connection pooling
│
├── 📁 logger/                           # 📝 LOGGING
│   └── logger.ts                        # Winston logger setup
│       ├── Console transport (dev)
│       ├── File transport (daily rotate)
│       └── Error-only file transport
│
├── 📁 middleware/                       # 🛡️  MIDDLEWARE
│   ├── auth.ts                          # Authentication middleware
│   │   ├── validateRequest()
│   │   ├── validateSession()
│   │   └── Token verification
│   ├── permissions.ts                   # Permission middleware
│   │   ├── checkPermission()
│   │   ├── requirePermission()
│   │   └── Permission helpers
│   └── permission-check.ts              # Permission utilities
│       └── checkPermissionOrReturnError()
│
├── 📁 response/                         # 📤 API RESPONSES
│   └── response.ts                      # Standard response format
│       ├── SUCCESS.json()
│       ├── ERROR.json()
│       └── Error codes (400, 401, 403...)
│
├── 📁 multilingual/                     # 🌍 INTERNATIONALIZATION
│   └── i18n.ts                          # Translation loader
│       ├── loadTranslations()
│       └── Language types
│
├── 📁 email/                            # 📧 EMAIL SERVICE
│   └── email.ts                         # Nodemailer setup
│       ├── sendEmail()
│       └── Email templates
│
├── 📁 sms/                              # 📱 SMS SERVICE
│   └── sms.ts                           # Twilio integration
│       └── sendSMS()
│
├── 📁 enum/                             # 📋 ENUMERATIONS
│   └── enum.ts                          # App constants
│       ├── User statuses
│       ├── Permission types
│       └── Activity types
│
└── 📁 utils/                            # 🔧 UTILITIES
    ├── date-format.ts                   # Date formatting
    │   ├── formatDate()
    │   └── formatRelativeTime()
    ├── auth-redirect.ts                 # Auth redirect helpers
    │   └── buildLoginUrl()
    └── helpers.ts                       # General helpers
        ├── generateOTP()
        └── slugify()`
  },

  services: {
    title: "📁 Services Structure",
    description: "Client-side API service classes for data fetching",
    content: `src/services/
│
├── auth.service.ts                      # 🔐 AUTHENTICATION SERVICE
│   │
│   ├── login(email, password)           # User login
│   ├── signup(userData)                 # User registration
│   ├── logout()                         # Clear session
│   ├── refreshToken(refresh_token)      # Refresh access token
│   ├── forgotPassword(email)            # Request reset link
│   ├── resetPassword(token, password)   # Set new password
│   ├── verifyEmail(otp)                 # Verify email OTP
│   ├── verifyPhone(otp)                 # Verify phone OTP
│   ├── sendOtp(type, destination)       # Send verification OTP
│   └── getTokenInfo(token)              # Get token details
│
├── user.service.ts                      # 👥 USER SERVICE
│   │
│   ├── getUsers(params)                 # List users (paginated)
│   ├── getUserById(id)                  # Get single user
│   ├── createUser(data)                 # Create new user
│   ├── updateUser(id, data)             # Update user
│   └── deleteUser(id)                   # Delete user
│
├── permission.service.ts                # 🔑 PERMISSION SERVICE
│   │
│   ├── getMyPermissions()               # Current user permissions
│   ├── getMyGroups()                    # Current user groups
│   ├── getAllPermissions()              # List all permissions
│   ├── getAllGroups()                   # List all groups
│   ├── createGroup(data)                # Create role group
│   ├── updateGroup(id, data)            # Update group
│   ├── assignPermissions(groupId, perms) # Assign to group
│   └── assignUserToGroup(userId, groupId) # Add user to group
│
├── media.service.ts                     # 🖼️  MEDIA SERVICE
│   │
│   ├── getMedia(params)                 # List media files
│   ├── uploadMedia(file, folder)        # Upload file
│   ├── deleteMedia(id)                  # Delete file
│   ├── createFolder(name)               # Create folder
│   ├── getFolders()                     # List folders
│   └── getStatistics()                  # Storage stats
│
├── notification.service.ts              # 🔔 NOTIFICATION SERVICE
│   │
│   ├── getNotifications(params)         # List notifications
│   ├── markAsRead(id)                   # Mark single read
│   ├── markAllAsRead()                  # Mark all read
│   └── getUnreadCount()                 # Count unread
│
├── dashboard.service.ts                 # 📊 DASHBOARD SERVICE
│   │
│   ├── getOverview()                    # Overview statistics
│   ├── getAllStatistics()               # Full dashboard data
│   ├── getUserGrowth(period)            # User growth chart
│   ├── getUsersByStatus()               # Status breakdown
│   └── getActivityStats()               # Activity metrics
│
├── profile.service.ts                   # 👤 PROFILE SERVICE
│   │
│   ├── getProfile()                     # Get current profile
│   ├── updateProfile(data)              # Update profile
│   ├── updateAvatar(file)               # Upload avatar
│   ├── changePassword(old, new)         # Change password
│   ├── updateTheme(theme)               # Set theme preference
│   └── clearProfileCache()              # Clear cached data
│
├── activity.service.ts                  # 📋 ACTIVITY SERVICE
│   │
│   ├── getLogs(params)                  # Get activity logs
│   └── getMyActivity(params)            # Current user activity
│
└── project.service.ts                   # ⚙️  PROJECT SERVICE
    │
    ├── getProjectInformation()          # Get project settings
    └── updateProjectInformation(data)   # Update settings`
  }
}

// Architecture diagrams with descriptions
const architectures = {
  overview: {
    title: "🏗️ System Overview",
    description: "High-level architecture showing all system components and their interactions",
    icon: Layers,
    diagram: `
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Next.js   │  │  Socket.io  │  │     Local Storage       │  │
│  │   Client    │  │   Client    │  │  (Tokens, Preferences)  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS SERVER                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API Routes (RSC)                     │    │
│  │  /api/auth  /api/users  /api/media  /api/dashboard      │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────┼──────────────────────────────────┐    │
│  │                 Custom Server (server.js)               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │   HTTP      │  │  Socket.io  │  │   Middleware    │  │    │
│  │  │   Server    │  │   Server    │  │   (Auth, CORS)  │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌───────────────────┐              ┌───────────────────────────┐
│    PostgreSQL     │              │         Redis             │
│  ┌─────────────┐  │              │  ┌─────────────────────┐  │
│  │   Users     │  │              │  │   Session Cache     │  │
│  │   Groups    │  │              │  │   API Cache         │  │
│  │   Media     │  │              │  │   Rate Limiting     │  │
│  │   Activity  │  │              │  └─────────────────────┘  │
│  └─────────────┘  │              └───────────────────────────┘
└───────────────────┘`,
  },
  auth: {
    title: "🔐 Authentication Flow",
    description: "Complete JWT authentication flow from login to protected API requests",
    icon: Key,
    diagram: `
┌──────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                       │
└──────────────────────────────────────────────────────────────┘

  ┌─────────┐         ┌─────────────┐         ┌─────────────┐
  │  User   │ ──1──▶  │  /api/auth  │ ──2──▶  │  Database   │
  │ Browser │         │   /login    │         │  (Prisma)   │
  └─────────┘         └─────────────┘         └─────────────┘
       │                     │                       │
       │                     │ ◀──3── Verify User ───┘
       │                     │
       │              ┌──────┴──────┐
       │              │ Generate    │
       │              │ JWT Tokens  │
       │              │ • access    │
       │              │ • refresh   │
       │              │ • session   │
       │              └──────┬──────┘
       │                     │
       │ ◀────4── Return ────┘
       │         Tokens
       │
       ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    CLIENT STORAGE                       │
  │  localStorage: { auth_tokens, auth_user, auth_groups }  │
  │  cookie: refresh_token (httpOnly for security)          │
  └─────────────────────────────────────────────────────────┘
       │
       │ ──5── Subsequent Requests with X-Session-Token ──▶
       │
       ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   AUTH MIDDLEWARE                       │
  │  1. Extract token from header                           │
  │  2. Verify JWT signature                                │
  │  3. Check session in database                           │
  │  4. Attach user to request                              │
  │  5. Check permissions if required                       │
  └─────────────────────────────────────────────────────────┘`,
  },
  proxy: {
    title: "🌐 Proxy & Deployment",
    description: "Production deployment architecture with Nginx, PM2, and external services",
    icon: Network,
    diagram: `
┌──────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                     │
└──────────────────────────────────────────────────────────────┘

    INTERNET
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                 │
│  • SSL Termination (HTTPS)                                 │
│  • Load Balancing                                          │
│  • Static File Caching                                     │
│  • Gzip Compression                                        │
│  • Rate Limiting                                           │
└────────────────────────────────────────────────────────────┘
        │
        ├──── /api/*  ────────────────────┐
        │                                 │
        ├──── /socket.io/* ───────────────┤
        │                                 │
        └──── /* (static) ────────────────┤
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────┐
│                    PM2 PROCESS MANAGER                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Instance 1 │  │  Instance 2 │  │  Instance N │        │
│  │  (Cluster)  │  │  (Cluster)  │  │  (Cluster)  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │               │
│         └────────────────┼────────────────┘               │
│                          │                                │
│  ┌───────────────────────┴───────────────────────────┐    │
│  │              Next.js Server (server.js)           │    │
│  │  • HTTP Server (port 3000)                        │    │
│  │  • Socket.io Server (same port, upgrade)          │    │
│  │  • API Routes Handler                             │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
┌─────────────────┐      ┌─────────────────┐
│   PostgreSQL    │      │     Redis       │
│   (Primary)     │      │   (Cluster)     │
│                 │      │                 │
│  • Users        │      │  • Sessions     │
│  • Media        │      │  • Cache        │
│  • Activity     │      │  • Pub/Sub      │
└─────────────────┘      └─────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │    SMTP     │  │   Twilio    │  │   S3 / Cloud        │   │
│  │   Server    │  │   (SMS)     │  │   Storage           │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘`,
  },
  websocket: {
    title: "⚡ WebSocket Real-time",
    description: "Socket.io server architecture for real-time notifications and updates",
    icon: RefreshCw,
    diagram: `
┌──────────────────────────────────────────────────────────────┐
│                   REAL-TIME WEBSOCKET FLOW                   │
└──────────────────────────────────────────────────────────────┘

  ┌─────────────────┐              ┌─────────────────┐
  │   Browser 1     │              │   Browser 2     │
  │  (User A)       │              │  (User B)       │
  └────────┬────────┘              └────────┬────────┘
           │                                │
           │  1. Connect with JWT           │
           │                                │
           ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    SOCKET.IO SERVER                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  CONNECTION HANDLER                   │  │
│  │  • Validate JWT Token                                 │  │
│  │  • Extract user_id from token                         │  │
│  │  • Join user to personal room: user:{user_id}         │  │
│  │  • Store socket mapping                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                      ROOMS                            │  │
│  │  • user:uuid-xxx  (personal notifications)            │  │
│  │  • dashboard      (dashboard subscribers)             │  │
│  │  • admin          (admin broadcasts)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     EVENTS                            │  │
│  │  • notification:new     → Personal notification       │  │
│  │  • user:created         → User created broadcast      │  │
│  │  • user:updated         → User updated broadcast      │  │
│  │  • dashboard:stats      → Dashboard stats update      │  │
│  │  • media:created        → Media upload notification   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │
           │  2. API triggers event
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ROUTE HANDLER                        │
│  // Example: User created                                   │
│  await prisma.user.create({ ... });                         │
│                                                             │
│  // Emit to all dashboard subscribers                       │
│  emitUserCreated(newUser);                                  │
│                                                             │
│  // Emit to specific user                                   │
│  emitNotificationToUser(userId, notification);              │
└─────────────────────────────────────────────────────────────┘`,
  },
}

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t: tGeneral } = useModuleI18n("general")
  const [activeStructureTab, setActiveStructureTab] = useState("root")
  const [activeArchTab, setActiveArchTab] = useState("overview")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold">Next.js Starter</span>
              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">v1.0</span>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                  {tGeneral("dashboard") || "Dashboard"}
                </Button>
                <Button onClick={() => router.push("/profile-settings")}>
                  {tGeneral("profile") || "Profile"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => router.push("/login")}>
                  {tGeneral("login") || "Login"}
                </Button>
                <Button onClick={() => router.push("/signup")}>
                  {tGeneral("get_started") || "Get Started"}
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
            <Code2 className="h-4 w-4" />
            <span>Production-Ready Next.js Starter Template</span>
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Build Full-Stack Apps
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {" "}10x Faster
            </span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl max-w-3xl mx-auto">
            A comprehensive Next.js 16 starter with authentication, user management, real-time WebSocket, 
            media uploads, dashboard analytics, and multi-language support. Everything you need to launch your SaaS.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {user ? (
              <Button size="lg" onClick={() => router.push("/dashboard")} className="w-full sm:w-auto">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => router.push("/signup")} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push("/login")} className="w-full sm:w-auto">
                  Sign In
                </Button>
              </>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "API Endpoints", value: "50+", icon: Server },
              { label: "Components", value: "40+", icon: Box },
              { label: "Features", value: "100+", icon: CheckCircle2 },
              { label: "TypeScript", value: "100%", icon: FileCode },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
                <stat.icon className="mx-auto h-6 w-6 text-primary mb-2" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">About This Starter</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              This is a production-ready Next.js starter template designed to accelerate your development process. 
              It includes everything you need to build a modern full-stack web application.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle>Built for Speed</CardTitle>
                <CardDescription>
                  Turbopack for instant HMR, React Compiler for automatic optimization, 
                  and Redis caching for blazing fast responses.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle>Security First</CardTitle>
                <CardDescription>
                  JWT authentication, session management, password hashing, 
                  rate limiting, and role-based access control out of the box.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                  <Layers className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Fully Typed</CardTitle>
                <CardDescription>
                  100% TypeScript with strict mode, Prisma for type-safe database queries, 
                  and comprehensive type definitions throughout.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Complete Feature Set</h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to build a production-ready application
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureCategories.map((category, idx) => (
              <Card key={idx} className="border-2 hover:shadow-lg transition-all">
                <CardHeader>
                  <div className={`h-10 w-10 rounded-lg bg-current/10 flex items-center justify-center mb-2 ${category.color}`}>
                    <category.icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                  <CardTitle className="text-lg">{category.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">{feature.name}</span>
                          <span className="text-muted-foreground"> - {feature.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Tech Stack</h2>
            <p className="text-lg text-muted-foreground">
              Modern technologies for building scalable applications
            </p>
          </div>
          
          <Tabs defaultValue="frontend" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="frontend" className="flex items-center gap-2">
                <Layout className="h-4 w-4" />
                Frontend
              </TabsTrigger>
              <TabsTrigger value="backend" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Backend
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Services
              </TabsTrigger>
            </TabsList>
            
            {Object.entries(techStack).map(([key, items]) => (
              <TabsContent key={key} value={key}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {items.map((item, i) => (
                    <Card key={i} className="border hover:border-primary/50 transition-all">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon}</span>
                          <CardTitle className="text-base">{item.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Folder Structure Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Project Structure</h2>
            <p className="text-lg text-muted-foreground">
              Well-organized folder structure for maintainability and scalability
            </p>
          </div>
          
          <Tabs value={activeStructureTab} onValueChange={setActiveStructureTab} className="w-full">
            <TabsList className="flex flex-wrap justify-center gap-2 mb-8 h-auto p-2">
              <TabsTrigger value="root" className="flex items-center gap-2 px-4 py-2">
                <FolderTree className="h-4 w-4" />
                <span className="hidden sm:inline">Project</span> Root
              </TabsTrigger>
              <TabsTrigger value="src" className="flex items-center gap-2 px-4 py-2">
                <Folder className="h-4 w-4" />
                Source Code
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center gap-2 px-4 py-2">
                <Server className="h-4 w-4" />
                API Routes
              </TabsTrigger>
              <TabsTrigger value="components" className="flex items-center gap-2 px-4 py-2">
                <Box className="h-4 w-4" />
                Components
              </TabsTrigger>
              <TabsTrigger value="lib" className="flex items-center gap-2 px-4 py-2">
                <FileCode className="h-4 w-4" />
                Utilities
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2 px-4 py-2">
                <Network className="h-4 w-4" />
                Services
              </TabsTrigger>
            </TabsList>
            
            {Object.entries(folderStructure).map(([key, data]) => (
              <TabsContent key={key} value={key}>
                <Card className="border-2">
                  <CardHeader className="border-b bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderTree className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{data.title}</CardTitle>
                        <CardDescription className="mt-1">{data.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <pre className="text-xs sm:text-sm font-mono bg-slate-950 text-emerald-400 p-4 sm:p-6 min-w-[600px] leading-relaxed">
                        {data.content}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">System Architecture</h2>
            <p className="text-lg text-muted-foreground">
              Understanding the system design, data flow, and deployment architecture
            </p>
          </div>
          
          <Tabs value={activeArchTab} onValueChange={setActiveArchTab} className="w-full">
            <TabsList className="flex flex-wrap justify-center gap-2 mb-8 h-auto p-2">
              <TabsTrigger value="overview" className="flex items-center gap-2 px-4 py-2">
                <Layers className="h-4 w-4" />
                System Overview
              </TabsTrigger>
              <TabsTrigger value="auth" className="flex items-center gap-2 px-4 py-2">
                <Key className="h-4 w-4" />
                Auth Flow
              </TabsTrigger>
              <TabsTrigger value="proxy" className="flex items-center gap-2 px-4 py-2">
                <Network className="h-4 w-4" />
                Deployment
              </TabsTrigger>
              <TabsTrigger value="websocket" className="flex items-center gap-2 px-4 py-2">
                <RefreshCw className="h-4 w-4" />
                WebSocket
              </TabsTrigger>
            </TabsList>
            
            {Object.entries(architectures).map(([key, arch]) => (
              <TabsContent key={key} value={key}>
                <Card className="border-2">
                  <CardHeader className="border-b bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <arch.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{arch.title}</CardTitle>
                        <CardDescription className="mt-1">{arch.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <pre className="text-xs sm:text-sm font-mono bg-slate-950 text-cyan-400 p-4 sm:p-6 min-w-[700px] whitespace-pre leading-relaxed">
                        {arch.diagram}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Quick Start</h2>
            <p className="text-lg text-muted-foreground">
              Get up and running in minutes
            </p>
          </div>
          
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    1. Clone & Install
                  </h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
{`git clone https://github.com/your-repo/nextjs-starter.git
cd nextjs-starter/app
npm install`}
                  </pre>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    2. Configure Environment
                  </h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
{`cp example.env .env
# Edit .env with your database, Redis, and service credentials`}
                  </pre>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    3. Setup Database
                  </h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
{`npm run db:push      # Push schema to database
npm run db:seed      # Seed default data (admin user, permissions)`}
                  </pre>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    4. Start Development
                  </h3>
                  <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
{`npm run dev          # Start with Turbopack (fastest)
# or
npm run dev:socket   # Start with custom server (Socket.io)`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-4xl border-2 border-primary/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Ready to Build?</CardTitle>
            <CardDescription className="text-lg">
              Start building your next project with this production-ready starter template
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-4">
            {user ? (
              <Button size="lg" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => router.push("/signup")} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push("/login")}>
                  Sign In
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <FrontendFooter />
    </div>
  )
}
