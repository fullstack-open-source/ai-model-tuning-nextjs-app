"use client"

import { useRouter } from "next/navigation"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { DatasetTutorial } from "@components/bots/dataset-tutorial"
import { Button } from "@components/ui/button"
import { ArrowLeft, Sparkles } from "lucide-react"

export default function FineTuneGuidePage() {
  const router = useRouter()

  return (
    <PageGuard requireAdmin={true}>
      <MainLayout
        title="Fine-tuning Guide"
        description="Learn how to create valid JSONL training files for fine-tuning"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => router.push("/admin/bots/fine-tune")} variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Fine-tuning
            </Button>
            <Button onClick={() => router.push("/admin/bots/datasets?tab=generation")} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Auto-Generate Dataset
            </Button>
          </div>
        }
      >
        <div className="w-full px-4 md:px-6 pt-0">
          <div className="max-w-4xl mx-auto">
            <DatasetTutorial />
          </div>
        </div>
      </MainLayout>
    </PageGuard>
  )
}

