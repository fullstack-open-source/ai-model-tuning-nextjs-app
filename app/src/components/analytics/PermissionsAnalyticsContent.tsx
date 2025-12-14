"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Shield, BarChart3, TrendingUp, Tag } from "lucide-react"

export interface PermissionsStatistics {
  total_permissions: number
  permissions_by_category: Array<{
    category: string
    count: number
  }>
  permissions_with_groups: number
  permissions_without_groups: number
  total_group_assignments: number
  most_used_permissions: Array<{
    permission_id: string
    name: string
    codename: string
    category: string
    group_count: number
  }>
  permissions_detail: Array<{
    permission_id: string
    name: string
    codename: string
    category: string
    group_count: number
  }>
}

interface PermissionsAnalyticsContentProps {
  stats: PermissionsStatistics
}

export function PermissionsAnalyticsContent({ stats }: PermissionsAnalyticsContentProps) {
  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_permissions}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Permissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.permissions_with_groups}</div>
            <p className="text-xs text-muted-foreground">{stats.permissions_without_groups} unassigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_group_assignments}</div>
            <p className="text-xs text-muted-foreground">Permission-group links</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Tag className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.permissions_by_category.length}</div>
            <p className="text-xs text-muted-foreground">Permission categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissions by Category</CardTitle>
          <CardDescription>Distribution across categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.permissions_by_category.map((category) => (
              <div key={category.category} className="flex items-center justify-between p-2 rounded-lg border">
                <span className="text-sm font-medium capitalize">{category.category || 'uncategorized'}</span>
                <span className="text-sm font-semibold">{category.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Most Used Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most Used Permissions</CardTitle>
          <CardDescription>Top 5 permissions assigned to groups</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.most_used_permissions.slice(0, 5).map((permission) => (
              <div
                key={permission.permission_id}
                className="flex items-center justify-between p-2 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{permission.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{permission.codename}</div>
                </div>
                <div className="text-sm font-semibold">{permission.group_count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
