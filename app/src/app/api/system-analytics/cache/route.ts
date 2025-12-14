import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@lib/middleware/auth"
import { checkPermissionOrReturnError } from "@lib/middleware/permission-check"
import { exec } from "child_process"
import { promisify } from "util"
import { redisConfig } from "@lib/config/env"
import { HybridCache } from "@lib/cache/cache"

const execAsync = promisify(exec)

interface RedisKey {
  key: string
  type: string
  ttl: number | null
  size: number
  sizeFormatted: string
  value?: string
  valuePreview?: string
  privacy?: "private" | "public"
}

interface RedisCacheStats {
  totalKeys: number
  totalMemory: number
  totalMemoryFormatted: string
  keysByType: Record<string, number>
  memoryByType: Record<string, number>
  keys: RedisKey[]
}

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Get Redis connection command - build command array properly
function getRedisCommand(command: string): string {
  const { host, port, password, db } = redisConfig
  const parts: string[] = ["redis-cli"]
  
  if (host && host !== "localhost") {
    parts.push("-h", host)
  }
  if (port && port !== 6379) {
    parts.push("-p", String(port))
  }
  if (password) {
    parts.push("-a", password)
  }
  if (db && db !== 0) {
    parts.push("-n", String(db))
  }
  
  // Add the actual command - split by spaces but preserve quoted strings
  const commandParts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [command]
  parts.push(...commandParts)
  
  // Join with spaces - no extra quoting needed as exec handles it
  return parts.join(" ")
}

// Escape key for Redis command
function escapeKey(key: string): string {
  // Escape special characters and wrap in quotes
  return `"${key.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const permissionError = await checkPermissionOrReturnError(user, "view_cache_statistics");
    if (permissionError) return permissionError;

    // Get filter parameter
    const url = new URL(req.url)
    const filterOwn = url.searchParams.get('filter_own') === 'true'
    const userId = user.user_id || user.uid || null

    // Helper function to determine if a key is private (contains sensitive user data)
    const isPrivateKey = (key: string): boolean => {
      const privatePatterns = [
        /^session:/,
        /^session_token:/,
        /^refresh_token:/,
        /^user_sessions:/,
        /^blacklisted_token:/,
        /^blacklist:/,
        /^profile:/,
        /^user:[^:]+:permissions$/,
        /^user:[^:]+:groups$/,
      ]
      // Notifications, activity logs, dashboard, groups, permissions lists are public
      // Only user-specific sensitive data is private
      return privatePatterns.some(pattern => pattern.test(key))
    }

    // Helper function to check if a key belongs to the current user
    const isUserKey = (key: string, currentUserId: string | null): boolean => {
      if (!currentUserId) return false
      return key.includes(currentUserId)
    }

    // Helper function to determine if a key should be visible
    const shouldShowKey = (key: string, currentUserId: string | null, filterOwnOnly: boolean): boolean => {
      if (filterOwnOnly) {
        // Filter mode: only show user's own keys
        return isUserKey(key, currentUserId)
      } else {
        // Normal mode: show public keys + user's own private keys
        if (isPrivateKey(key)) {
          // Only show private keys if they belong to the current user
          return isUserKey(key, currentUserId)
        } else {
          // Show all public keys
          return true
        }
      }
    }

    // Try to get cache instance to check if using Redis or local
    const cacheInstance = HybridCache.getInstance()
    await cacheInstance.init()
    
    // Check cache type (Redis or local) - access private properties via type assertion
    interface CacheInstance {
      useRedis?: boolean;
      localCache?: Record<string, { value: unknown; ttl: number | null; setTime: number }>;
      redisClient?: { ping: () => Promise<string> } | null;
    }
    const cacheInstanceTyped = cacheInstance as unknown as CacheInstance
    
    // Check if Redis is actually connected by trying to ping
    let isRedisAvailable = false
    let cacheType: "redis" | "local" = "local"
    
    if (cacheInstanceTyped.useRedis && cacheInstanceTyped.redisClient) {
      try {
        await cacheInstanceTyped.redisClient.ping()
        isRedisAvailable = true
        cacheType = "redis"
      } catch {
        // Redis client exists but not connected, fall back to local
        cacheType = "local"
      }
    }
    
    // If Redis is enabled but not available, check if we should use local cache
    if (!isRedisAvailable && redisConfig.enabled) {
      // Redis is configured but not connected - use local cache
      cacheType = "local"
    }
    
    // If using local cache, get keys from local cache
    if (cacheType === "local") {
      const localCache = cacheInstanceTyped.localCache || {}
      const localKeys = Object.keys(localCache)
      
      const keysByType: Record<string, number> = { "string": localKeys.length }
      const memoryByType: Record<string, number> = {}
      const keyDetails: RedisKey[] = []

      for (const key of localKeys) {
        const item = localCache[key]
        const value = item?.value
        const valueStr = typeof value === "string" ? value : JSON.stringify(value)
        const size = Buffer.byteLength(valueStr, "utf8")
        
        const ttl = item?.ttl || null
        const setTime = item?.setTime || Date.now()
        const elapsed = (Date.now() - setTime) / 1000
        const remainingTTL = ttl ? Math.max(0, ttl - elapsed) : null

        keysByType["string"] = (keysByType["string"] || 0) + 1
        memoryByType["string"] = (memoryByType["string"] || 0) + size

        keyDetails.push({
          key,
          type: "string",
          ttl: remainingTTL ? Math.floor(remainingTTL) : null,
          size,
          sizeFormatted: formatBytes(size),
          valuePreview: valueStr.length > 100 ? valueStr.substring(0, 100) + "..." : valueStr,
          privacy: isPrivateKey(key) ? "private" : "public",
        })
      }

      // Filter keys based on privacy and user ownership
      const filteredKeyDetails = keyDetails.filter(keyDetail => 
        shouldShowKey(keyDetail.key, userId, filterOwn)
      )
      const filteredLocalKeys = localKeys.filter(key => 
        shouldShowKey(key, userId, filterOwn)
      )
      
      // Recalculate stats for filtered keys
      const filteredKeysByType: Record<string, number> = {}
      const filteredMemoryByType: Record<string, number> = {}
      let filteredTotalMemory = 0
      
      filteredKeyDetails.forEach(keyDetail => {
        filteredKeysByType[keyDetail.type] = (filteredKeysByType[keyDetail.type] || 0) + 1
        filteredMemoryByType[keyDetail.type] = (filteredMemoryByType[keyDetail.type] || 0) + keyDetail.size
        filteredTotalMemory += keyDetail.size
      })
      
      const finalKeysByType = filteredKeysByType
      const finalMemoryByType = filteredMemoryByType
      const finalTotalMemory = filteredTotalMemory

      const stats: RedisCacheStats = {
        totalKeys: filteredLocalKeys.length,
        totalMemory: finalTotalMemory,
        totalMemoryFormatted: formatBytes(finalTotalMemory),
        keysByType: finalKeysByType,
        memoryByType: finalMemoryByType,
        keys: filteredKeyDetails,
      }

      return NextResponse.json({
        success: true,
        data: stats,
        available: true,
        cacheType: "local",
      })
    }

    // Redis path - Check if Redis CLI is available
    try {
      await execAsync("which redis-cli")
    } catch {
      // Redis CLI not available, but might still be using Redis via client
      return NextResponse.json({
        error: "Redis CLI not available for inspection",
        available: false,
        cacheType: "redis",
        message: "Redis is configured but CLI tools are not available for key inspection",
      }, { status: 503 })
    }

    // Test Redis connection via CLI
    try {
      const pingCmd = getRedisCommand("PING")
      const { stdout: pingResult } = await execAsync(pingCmd)
      if (!pingResult.trim().includes("PONG")) {
        throw new Error("Redis connection failed")
      }
    } catch (error) {
      return NextResponse.json({
        error: "Redis connection failed",
        available: false,
        cacheType: "redis",
        message: error instanceof Error ? error.message : "Unknown error",
      }, { status: 503 })
    }

    // Get all keys - use Redis client directly instead of CLI to avoid shell interpretation
    let keys: string[] = []
    try {
      // Use Redis client directly if available
      if (cacheInstanceTyped.redisClient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = cacheInstanceTyped.redisClient as any
        
        // Try SCAN first (recommended for production, doesn't block Redis)
        if (client.scan) {
          let cursor = '0'
          do {
            const [nextCursor, scannedKeys] = await client.scan(cursor, 'MATCH', '*', 'COUNT', 1000)
            cursor = nextCursor
            if (scannedKeys && Array.isArray(scannedKeys)) {
              keys.push(...scannedKeys)
            }
          } while (cursor !== '0')
        } 
        // Fallback to KEYS if SCAN not available
        else if (client.keys) {
          keys = await client.keys('*')
        }
        // If neither available, try CLI as last resort
        else {
          // Use CLI with proper quoting to prevent shell expansion
          const keysCmd = getRedisCommand('KEYS "*"')
          const { stdout: keysOutput } = await execAsync(keysCmd, {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large key lists
          })
          const output = keysOutput.trim()
          if (output && !output.startsWith("ERR")) {
            keys = output.split("\n")
              .map(k => k.trim())
              .filter((k) => k.length > 0)
          }
        }
      } else {
        // Redis client not available, try CLI
        const keysCmd = getRedisCommand('KEYS "*"')
        const { stdout: keysOutput } = await execAsync(keysCmd, {
          maxBuffer: 10 * 1024 * 1024,
        })
        const output = keysOutput.trim()
        if (output && !output.startsWith("ERR")) {
          keys = output.split("\n")
            .map(k => k.trim())
            .filter((k) => k.length > 0)
        }
      }
    } catch (error) {
      console.error("Error fetching keys:", error)
      keys = []
    }

    // Memory info will be calculated from filtered keys

    // Get key details - use Redis client directly if available
    const keysByType: Record<string, number> = {}
    const memoryByType: Record<string, number> = {}
    const keyDetails: RedisKey[] = []

    // Use Redis client directly for better performance
    const useClient = cacheInstanceTyped.redisClient && isRedisAvailable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = useClient ? (cacheInstanceTyped.redisClient as any) : null

    for (const key of keys.slice(0, 1000)) { // Limit to 1000 keys for performance
      try {
        let type = "string"
        let ttl: number | null = null
        let size = 0
        let valuePreview = ""

        if (client) {
          // Use Redis client directly
          try {
            type = (await client.type(key) || "string").toLowerCase()
            
            // Get TTL
            const ttlValue = await client.ttl(key)
            ttl = ttlValue > 0 ? ttlValue : null

            // Get key size and value preview
            if (type === "string") {
              const value = await client.get(key)
              if (value) {
                size = Buffer.byteLength(value, "utf8")
                valuePreview = value.length > 100 ? value.substring(0, 100) + "..." : value
              }
            } else if (type === "list") {
              const len = await client.llen(key) || 0
              size = len * 50 // Approximate
              valuePreview = `List with ${len} items`
            } else if (type === "set") {
              const len = await client.scard(key) || 0
              size = len * 50 // Approximate
              valuePreview = `Set with ${len} items`
            } else if (type === "hash") {
              const len = await client.hlen(key) || 0
              size = len * 100 // Approximate
              valuePreview = `Hash with ${len} fields`
            } else if (type === "zset") {
              const len = await client.zcard(key) || 0
              size = len * 50 // Approximate
              valuePreview = `Sorted Set with ${len} items`
            }
          } catch (clientError) {
            console.error(`Error getting details for key ${key} via client:`, clientError)
            // Fall back to CLI
            type = "string"
          }
        }

        // Fallback to CLI if client not available or failed
        if (!useClient || type === "string" && size === 0) {
          const escapedKey = escapeKey(key)
          
          // Get key type
          const typeCmd = getRedisCommand(`TYPE ${escapedKey}`)
          const { stdout: typeOutput } = await execAsync(typeCmd)
          type = typeOutput.trim().toLowerCase()

          // Get TTL
          try {
            const ttlCmd = getRedisCommand(`TTL ${escapedKey}`)
            const { stdout: ttlOutput } = await execAsync(ttlCmd)
            const ttlValue = parseInt(ttlOutput.trim(), 10)
            ttl = ttlValue > 0 ? ttlValue : null
          } catch {
            // TTL might fail for some key types
          }

          // Get key size (approximate)
          try {
            if (type === "string") {
              const getCmd = getRedisCommand(`GET ${escapedKey}`)
              const { stdout: valueOutput } = await execAsync(getCmd)
              const value = valueOutput.trim()
              size = Buffer.byteLength(value, "utf8")
              valuePreview = value.length > 100 ? value.substring(0, 100) + "..." : value
            } else if (type === "list") {
              const lenCmd = getRedisCommand(`LLEN ${escapedKey}`)
              const { stdout: lenOutput } = await execAsync(lenCmd)
              const len = parseInt(lenOutput.trim(), 10) || 0
              size = len * 50 // Approximate
              valuePreview = `List with ${len} items`
            } else if (type === "set") {
              const lenCmd = getRedisCommand(`SCARD ${escapedKey}`)
              const { stdout: lenOutput } = await execAsync(lenCmd)
              const len = parseInt(lenOutput.trim(), 10) || 0
              size = len * 50 // Approximate
              valuePreview = `Set with ${len} items`
            } else if (type === "hash") {
              const lenCmd = getRedisCommand(`HLEN ${escapedKey}`)
              const { stdout: lenOutput } = await execAsync(lenCmd)
              const len = parseInt(lenOutput.trim(), 10) || 0
              size = len * 100 // Approximate
              valuePreview = `Hash with ${len} fields`
            } else if (type === "zset") {
              const lenCmd = getRedisCommand(`ZCARD ${escapedKey}`)
              const { stdout: lenOutput } = await execAsync(lenCmd)
              const len = parseInt(lenOutput.trim(), 10) || 0
              size = len * 50 // Approximate
              valuePreview = `Sorted Set with ${len} items`
            }
          } catch (error) {
            console.error(`Error getting details for key ${key}:`, error)
          }
        }

        keysByType[type] = (keysByType[type] || 0) + 1
        memoryByType[type] = (memoryByType[type] || 0) + size

        keyDetails.push({
          key,
          type,
          ttl,
          size,
          sizeFormatted: formatBytes(size),
          valuePreview,
          privacy: isPrivateKey(key) ? "private" : "public",
        })
      } catch (error) {
        console.error(`Error processing key ${key}:`, error)
      }
    }

    // Filter keys based on privacy and user ownership
    const filteredKeyDetails = keyDetails.filter(keyDetail => 
      shouldShowKey(keyDetail.key, userId, filterOwn)
    )
    const filteredKeys = keys.filter(key => 
      shouldShowKey(key, userId, filterOwn)
    )
    
    // Recalculate stats for filtered keys
    const filteredKeysByType: Record<string, number> = {}
    const filteredMemoryByType: Record<string, number> = {}
    let filteredTotalMemory = 0
    
    filteredKeyDetails.forEach(keyDetail => {
      filteredKeysByType[keyDetail.type] = (filteredKeysByType[keyDetail.type] || 0) + 1
      filteredMemoryByType[keyDetail.type] = (filteredMemoryByType[keyDetail.type] || 0) + keyDetail.size
      filteredTotalMemory += keyDetail.size
    })
    
    const finalKeysByType = filteredKeysByType
    const finalMemoryByType = filteredMemoryByType
    const finalTotalMemory = filteredTotalMemory

    const stats: RedisCacheStats = {
      totalKeys: filteredKeys.length,
      totalMemory: finalTotalMemory,
      totalMemoryFormatted: formatBytes(finalTotalMemory),
      keysByType: finalKeysByType,
      memoryByType: finalMemoryByType,
      keys: filteredKeyDetails,
    }

    return NextResponse.json({
      success: true,
      data: stats,
      available: true,
      cacheType: "redis",
    })
  } catch (error: unknown) {
    console.error("Redis cache API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch Redis cache data",
        message: error instanceof Error ? error.message : "Unknown error",
        available: false,
      },
      { status: 500 }
    )
  }
}

// DELETE - Flush all cache (delete all keys)
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const permissionError = await checkPermissionOrReturnError(user, "view_cache_statistics");
    if (permissionError) return permissionError;

    // Get cache instance
    const cacheInstance = HybridCache.getInstance()
    await cacheInstance.init()
    
    // Check cache type
    interface CacheInstance {
      useRedis?: boolean;
      localCache?: Record<string, { value: unknown; ttl: number | null; setTime: number }>;
      redisClient?: { flushdb: () => Promise<unknown>; ping: () => Promise<string> } | null;
    }
    const cacheInstanceTyped = cacheInstance as unknown as CacheInstance
    
    // Check if Redis is available
    let isRedisAvailable = false
    if (cacheInstanceTyped.useRedis && cacheInstanceTyped.redisClient) {
      try {
        await cacheInstanceTyped.redisClient.ping()
        isRedisAvailable = true
      } catch {
        // Redis not available
      }
    }
    
    if (isRedisAvailable && cacheInstanceTyped.redisClient) {
      // Flush Redis database
      try {
        await cacheInstanceTyped.redisClient.flushdb()
        return NextResponse.json({
          success: true,
          message: "All cache keys flushed successfully",
          cacheType: "redis",
        })
      } catch {
        // If flushdb fails, try using CLI
        try {
          const flushCmd = getRedisCommand("FLUSHDB")
          await execAsync(flushCmd)
          return NextResponse.json({
            success: true,
            message: "All cache keys flushed successfully",
            cacheType: "redis",
          })
        } catch (cliError: unknown) {
          console.error("Error flushing Redis cache:", cliError)
          return NextResponse.json(
            {
              error: "Failed to flush cache",
              message: cliError instanceof Error ? cliError.message : "Unknown error",
            },
            { status: 500 }
          )
        }
      }
    } else {
      // Flush local cache
      if (cacheInstanceTyped.localCache) {
        const keys = Object.keys(cacheInstanceTyped.localCache)
        for (const key of keys) {
          delete cacheInstanceTyped.localCache[key]
        }
        return NextResponse.json({
          success: true,
          message: `All local cache keys flushed successfully (${keys.length} keys deleted)`,
          cacheType: "local",
        })
      } else {
        return NextResponse.json({
          success: true,
          message: "Cache is empty",
          cacheType: "local",
        })
      }
    }
  } catch (error: unknown) {
    console.error("Flush cache API error:", error)
    return NextResponse.json(
      {
        error: "Failed to flush cache",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

