"use client"

import { useEffect } from "react"
import { useProject } from "@context/ProjectContext"

export function ProjectMetaProvider({ children }: { children: React.ReactNode }) {
  const { projectInfo } = useProject()

  useEffect(() => {
    if (!projectInfo) return

    // Update document title
    if (projectInfo.meta_title) {
      document.title = projectInfo.meta_title
    } else if (projectInfo.title) {
      document.title = projectInfo.title
    } else if (projectInfo.name) {
      document.title = projectInfo.name
    }

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string | null | undefined, attribute: string = "name") => {
      if (!content) return

      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement
      if (!element) {
        element = document.createElement("meta")
        element.setAttribute(attribute, name)
        document.head.appendChild(element)
      }
      element.setAttribute("content", content)
    }

    // Update standard meta tags
    if (projectInfo.meta_description) {
      updateMetaTag("description", projectInfo.meta_description)
    }
    if (projectInfo.meta_keywords) {
      updateMetaTag("keywords", projectInfo.meta_keywords)
    }

    // Inject head meta data (custom HTML) - parse and inject directly into head
    if (projectInfo.head_meta_data) {
      // Remove existing project head meta markers
      const existingMarkers = document.querySelectorAll('[data-project-meta="head"]')
      existingMarkers.forEach(marker => marker.remove())

      // Create a temporary container to parse HTML
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = projectInfo.head_meta_data
      
      // Move all nodes from temp div to head
      const fragment = document.createDocumentFragment()
      while (tempDiv.firstChild) {
        const node = tempDiv.firstChild
        // Clone the node before moving it
        const clonedNode = node.cloneNode(true)
        if (clonedNode.nodeType === Node.ELEMENT_NODE) {
          const element = clonedNode as Element
          element.setAttribute("data-project-meta", "head")
        }
        fragment.appendChild(clonedNode)
        // Now safely remove from tempDiv
        tempDiv.removeChild(node)
      }
      document.head.appendChild(fragment)
    }

    // Inject body meta data (scripts, etc.)
    if (projectInfo.body_meta_data) {
      // Remove existing body meta
      const existingBodyMeta = document.querySelectorAll('[data-project-meta="body"]')
      existingBodyMeta.forEach(marker => marker.remove())

      const bodyContainer = document.getElementById("project-body-meta")
      if (bodyContainer) {
        // Clear and inject new content
        bodyContainer.innerHTML = ""
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = projectInfo.body_meta_data
        while (tempDiv.firstChild) {
          const node = tempDiv.firstChild
          // Clone the node before moving it
          const clonedNode = node.cloneNode(true)
          if (clonedNode.nodeType === Node.ELEMENT_NODE) {
            const element = clonedNode as Element
            element.setAttribute("data-project-meta", "body")
          }
          bodyContainer.appendChild(clonedNode)
          // Now safely remove from tempDiv
          tempDiv.removeChild(node)
        }
      } else {
        // Create container if it doesn't exist
        const container = document.createElement("div")
        container.id = "project-body-meta"
        container.innerHTML = projectInfo.body_meta_data
        // Mark all injected elements
        container.querySelectorAll("*").forEach(el => {
          el.setAttribute("data-project-meta", "body")
        })
        document.body.appendChild(container)
      }
    }

    // Inject extra meta data into head
    if (projectInfo.extra_meta_data) {
      // Remove existing extra meta
      const existingExtraMeta = document.querySelectorAll('[data-project-meta="extra"]')
      existingExtraMeta.forEach(marker => marker.remove())

      // Create a temporary container to parse HTML
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = projectInfo.extra_meta_data
      
      // Move all nodes from temp div to head
      const fragment = document.createDocumentFragment()
      while (tempDiv.firstChild) {
        const node = tempDiv.firstChild
        // Clone the node before moving it
        const clonedNode = node.cloneNode(true)
        if (clonedNode.nodeType === Node.ELEMENT_NODE) {
          const element = clonedNode as Element
          element.setAttribute("data-project-meta", "extra")
        }
        fragment.appendChild(clonedNode)
        // Now safely remove from tempDiv
        tempDiv.removeChild(node)
      }
      document.head.appendChild(fragment)
    }
  }, [projectInfo])

  return <>{children}</>
}
