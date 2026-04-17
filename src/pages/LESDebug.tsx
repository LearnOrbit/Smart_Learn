/**
 * Debug page - check if LES Analytics is loading
 */
import { useAuth } from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/integrations/api/client"
import { Card, CardContent } from "@/components/ui/card"

export default function LESDebug() {
  const { user } = useAuth()
  
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
      <h1 className="text-2xl font-bold mb-6">LES Analytics Debug</h1>
      
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="font-bold mb-4">User Info</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="font-bold mb-4">Students Response</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(students, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-bold mb-4">Statistics Response</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(stats, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
