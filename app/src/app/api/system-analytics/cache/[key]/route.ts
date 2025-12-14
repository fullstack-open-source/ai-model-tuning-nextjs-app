import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@lib/middleware/auth"
import { checkPermissionOrReturnError } from "@lib/middleware/permission-check"
import { exec } from "child_process"
import { promisify } from "util"
import { redisConfig } from "@lib/config/env"
import { HybridCache } from "@lib/cache/cache"

const execAsync = promisify(exec)

// Get Redis connection command
function getRedisCommand(command: string): string {
  const { host, port, password, db } = redisConfig
  let cmd = `redis-cli`
  
  if (host && host !== "localhost") {
    cmd += ` -h "${host}"`
  }
  if (port && port !== 6379) {
    cmd += ` -p ${port}`
  }
  if (password) {
    // Escape password for shell
    const escapedPassword = password.replace(/"/g, '\\"')
    cmd += ` -a "${escapedPassword}"`
  }
  if (db && db !== 0) {
    cmd += ` -n ${db}`
  }
  
  cmd += ` ${command}`
  return cmd
}

// Escape key for Redis command
function escapeKey(key: string): string {
  // Escape special characters and wrap in quotes
  return `"${key.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`
}

// GET - Get key details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const permissionError = await checkPermissionOrReturnError(user, "manage_cache");
    if (permissionError) return permissionError;

    const { key: keyParam } = await params
    const key = decodeURIComponent(keyParam)

    // Get cache instance
    const cacheInstance = HybridCache.getInstance()
    await cacheInstance.init()
    
    // Check cache type
    interface CacheInstance {
      useRedis?: boolean;
      localCache?: Record<string, { value: unknown; ttl: number | null; setTime: number }>;
      redisClient?: { 
        type: (k: string) => Promise<string>;
        ttl: (k: string) => Promise<number>;
        get: (k: string) => Promise<string | null>;
        llen: (k: string) => Promise<number>;
        lrange: (k: string, start: number, stop: number) => Promise<string[]>;
        scard: (k: string) => Promise<number>;
        smembers: (k: string) => Promise<string[]>;
        hlen: (k: string) => Promise<number>;
        hgetall: (k: string) => Promise<Record<string, string>>;
        zcard: (k: string) => Promise<number>;
        zrange: (k: string, start: number, stop: number, ...args: string[]) => Promise<string[]>;
        ping: () => Promise<string>;
      } | null;
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
    
    let type = "string"
    let ttl: number | null = null
    let value: string | object | null = null
    let size = 0

    if (isRedisAvailable && cacheInstanceTyped.redisClient) {
      // Use Redis client directly
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = cacheInstanceTyped.redisClient as any
        
        type = (await client.type(key) || "string").toLowerCase()
        
        // Get TTL
        const ttlValue = await client.ttl(key)
        ttl = ttlValue > 0 ? ttlValue : null

        // Get value based on type
        if (type === "string") {
          const val = await client.get(key)
          if (val) {
            // Try to parse as JSON, if it fails, keep as string
            try {
              const parsed = JSON.parse(val)
              value = parsed // Return parsed JSON object
              size = Buffer.byteLength(val, "utf8") // Use original string size
            } catch {
              // Not valid JSON, keep as string
              value = val
              size = Buffer.byteLength(val, "utf8")
            }
          }
        } else if (type === "list") {
          const len = await client.llen(key) || 0
          const items = await client.lrange(key, 0, Math.min(len - 1, 99))
          value = {
            type: "list",
            length: len,
            items: items || [],
          }
          size = len * 50 // Approximate
        } else if (type === "set") {
          const len = await client.scard(key) || 0
          const items = await client.smembers(key) || []
          value = {
            type: "set",
            length: len,
            items: items.slice(0, 100),
          }
          size = len * 50 // Approximate
        } else if (type === "hash") {
          const len = await client.hlen(key) || 0
          const fields = await client.hgetall(key) || {}
          value = {
            type: "hash",
            length: len,
            fields: Object.keys(fields).slice(0, 100).reduce((acc, k) => {
              acc[k] = fields[k]
              return acc
            }, {} as Record<string, string>),
          }
          size = len * 100 // Approximate
        } else if (type === "zset") {
          const len = await client.zcard(key) || 0
          const items = await client.zrange(key, 0, Math.min(len - 1, 99), "WITHSCORES") || []
          const zsetItems: Array<{ member: string; score: number }> = []
          for (let i = 0; i < items.length; i += 2) {
            if (i + 1 < items.length) {
              zsetItems.push({
                member: items[i],
                score: parseFloat(items[i + 1]) || 0,
              })
            }
          }
          value = {
            type: "zset",
            length: len,
            items: zsetItems,
          }
          size = len * 50 // Approximate
        }
      } catch (clientError) {
        console.error(`Error getting key details via client:`, clientError)
        // Fall back to CLI
      }
    }

    // Fallback to local cache or CLI
    if (!isRedisAvailable || (value === null && size === 0)) {
      // Check local cache first
      if (cacheInstanceTyped.localCache && cacheInstanceTyped.localCache[key]) {
        const item = cacheInstanceTyped.localCache[key]
        type = "string"
        const itemValue = item?.value
        
        // If value is already an object, use it directly
        // If it's a string, try to parse as JSON
        if (typeof itemValue === "string") {
          try {
            value = JSON.parse(itemValue) as object // Parse JSON string to object
            size = Buffer.byteLength(itemValue, "utf8")
          } catch {
            // Not valid JSON, keep as string
            value = itemValue
            size = Buffer.byteLength(itemValue, "utf8")
          }
        } else if (itemValue !== null && itemValue !== undefined) {
          // Already an object
          value = itemValue as object
          const valueStr = JSON.stringify(itemValue)
          size = Buffer.byteLength(valueStr, "utf8")
        } else {
          value = null
          size = 0
        }
        
        const itemTtl = item?.ttl || null
        const setTime = item?.setTime || Date.now()
        const elapsed = (Date.now() - setTime) / 1000
        ttl = itemTtl ? Math.max(0, Math.floor(itemTtl - elapsed)) : null
      } else {
        // Use CLI as last resort
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

        // Get value
        try {
          if (type === "string") {
            const getCmd = getRedisCommand(`GET ${escapedKey}`)
            const { stdout: valueOutput } = await execAsync(getCmd)
            const rawValue = valueOutput.trim()
            
            // Try to parse as JSON, if it fails, keep as string
            try {
              value = JSON.parse(rawValue) // Parse JSON string to object
              size = Buffer.byteLength(rawValue, "utf8") // Use original string size
            } catch {
              // Not valid JSON, keep as string
              value = rawValue
              size = Buffer.byteLength(rawValue, "utf8")
            }
          }
          // For other types, we'd need to implement CLI fallbacks if needed
        } catch (error) {
          console.error(`Error getting value for key ${key}:`, error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        key,
        type: type || "string",
        ttl,
        size,
        value: value !== null ? value : null,
      },
    })
  } catch (error: unknown) {
    console.error("Redis key details API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch key details",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a key
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const permissionError = await checkPermissionOrReturnError(user, "manage_cache");
    if (permissionError) return permissionError;

    const { key: keyParam } = await params
    const key = decodeURIComponent(keyParam)

    // Get cache instance
    const cacheInstance = HybridCache.getInstance()
    await cacheInstance.init()
    
    // Check cache type
    interface CacheInstance {
      useRedis?: boolean;
      localCache?: Record<string, { value: unknown; ttl: number | null; setTime: number }>;
      redisClient?: { del: (k: string) => Promise<unknown>; ping: () => Promise<string> } | null;
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
      // Delete from Redis
      try {
        await cacheInstanceTyped.redisClient.del(key)
        return NextResponse.json({
          success: true,
          message: "Key deleted successfully",
        })
      } catch {
        // If client delete fails, try using CLI
        try {
          const escapedKey = escapeKey(key)
          const delCmd = getRedisCommand(`DEL ${escapedKey}`)
          const { stdout: delOutput } = await execAsync(delCmd)
          const deleted = parseInt(delOutput.trim(), 10) > 0

          if (!deleted) {
            return NextResponse.json(
              { error: "Key not found or could not be deleted" },
              { status: 404 }
            )
          }

          return NextResponse.json({
            success: true,
            message: "Key deleted successfully",
          })
        } catch (cliError: unknown) {
          console.error("Error deleting key via CLI:", cliError)
          return NextResponse.json(
            {
              error: "Failed to delete key",
              message: cliError instanceof Error ? cliError.message : "Unknown error",
            },
            { status: 500 }
          )
        }
      }
    } else {
      // Delete from local cache
      if (cacheInstanceTyped.localCache && cacheInstanceTyped.localCache[key]) {
        delete cacheInstanceTyped.localCache[key]
        return NextResponse.json({
          success: true,
          message: "Key deleted successfully",
        })
      } else {
        return NextResponse.json(
          { error: "Key not found" },
          { status: 404 }
        )
      }
    }
  } catch (error: unknown) {
    console.error("Cache key delete API error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete key",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

