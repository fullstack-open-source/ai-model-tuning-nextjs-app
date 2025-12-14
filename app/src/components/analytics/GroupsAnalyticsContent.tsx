"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Shield, Users, BarChart3, TrendingUp } from "lucide-react"

export interface GroupsStatistics {
  total_groups: number
  active_groups: number
  inactive_groups: number
  system_groups: number
  custom_groups: number
  groups_with_users: number
  groups_without_users: number
  total_users_in_groups: number
  groups_detail: Array<{
    group_id: string
    name: string
    codename: string
    is_system: boolean
    is_active: boolean
    user_count: number
    permission_count: number
  }>
}

interface GroupsAnalyticsContentProps {
  stats: GroupsStatistics
}

export function GroupsAnalyticsContent({ stats }: GroupsAnalyticsContentProps) {
  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_groups}</div>
            <p className="text-xs text-muted-foreground">
              {stats.system_groups} system, {stats.custom_groups} custom
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_groups}</div>
            <p className="text-xs text-muted-foreground">{stats.inactive_groups} inactive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Groups with Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.groups_with_users}</div>
            <p className="text-xs text-muted-foreground">{stats.groups_without_users} without users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_users_in_groups}</div>
            <p className="text-xs text-muted-foreground">Across all groups</p>
          </CardContent>
        </Card>
      </div>

      {/* Groups Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Groups Overview</CardTitle>
          <CardDescription>Detailed statistics for each group</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats.groups_detail.map((group) => (
              <div
                key={group.group_id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{group.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{group.codename}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium">{group.user_count}</div>
                    <div className="text-xs text-muted-foreground">Users</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{group.permission_count}</div>
                    <div className="text-xs text-muted-foreground">Perms</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
