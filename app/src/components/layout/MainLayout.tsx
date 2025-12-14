"use client"

import { ReactNode } from "react"
import { Navbar } from "./Navbar"
import { TopNav } from "./TopNav"
import { AdminFooter } from "@components/footer/AdminFooter"

interface MainLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
}

export function MainLayout({ children, title, description, actions }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Navbar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav title={title} description={description} actions={actions} />
          <main className="flex-1 overflow-y-auto p-0 m-0 pt-0 mt-0">
            {children}
          </main>
          <AdminFooter />
        </div>
      </div>
      
    </div>
  )
}

