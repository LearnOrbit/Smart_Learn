/**
 * Debug page - check if LES Analytics is loading
 */
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/integrations/api/client"
import { Card, CardContent } from "@/components/ui/card"
import { loadPageNamespace } from "@/i18n"

export default function LESDebug() {
  const { user } = useAuth()
  const { t } = useTranslation("pages")

  useEffect(() => { void loadPageNamespace("lesDebug"); }, []);

  const { data: students } = useQuery({
    queryKey: ["debug-students"],
    queryFn: () => apiClient.get("/analytics/students"),
    enabled: !!user,
  })

  const { data: stats } = useQuery({
    queryKey: ["debug-stats"],
    queryFn: () => apiClient.get("/analytics/statistical-validation"),
    enabled: !!user,
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("lesDebug:title")}</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="font-bold mb-4">{t("lesDebug:userInfo")}</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="font-bold mb-4">{t("lesDebug:studentsResponse")}</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(students, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-bold mb-4">{t("lesDebug:statisticsResponse")}</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(stats, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
