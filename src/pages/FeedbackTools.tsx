import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/integrations/api/client";
import { loadPageNamespace } from "@/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, BookOpen, Calendar, Loader2, AlertTriangle } from "lucide-react";

interface AdvisoryPlan {
  study_plan: string;
  concept_reinforcement: string;
  mini_project: string;
  adaptive_schedule: string;
}

export default function FeedbackTools() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");

  useEffect(() => { void loadPageNamespace("feedback"); }, []);

  // Advisory plan form state
  const [studentName, setStudentName] = useState("");
  const [weakConcepts, setWeakConcepts] = useState("");
  const [perfMarks, setPerfMarks] = useState("75");
  const [perfAttendance, setPerfAttendance] = useState("85");
  const [perfInternal, setPerfInternal] = useState("80");
  const [perfLab, setPerfLab] = useState("78");
  const [perfAssignments, setPerfAssignments] = useState("82");
  const [perfStudyHours, setPerfStudyHours] = useState("5");
  const [perfMastery, setPerfMastery] = useState("72");

  const advisoryMutation = useMutation<AdvisoryPlan>({
    mutationFn: async () => {
      const body = {
        student_name: studentName || "Student",
        weak_concepts: weakConcepts.split(",").map((s) => s.trim()).filter(Boolean),
        student_marks: Number(perfMarks),
        attendance: Number(perfAttendance),
        internal_assessments: Number(perfInternal),
        lab_performance: Number(perfLab),
        assignment_scores: Number(perfAssignments),
        study_hours: Number(perfStudyHours),
        concept_mastery: Number(perfMastery),
      };
      const { data, error } = await apiClient.post("/analytics/advisory-plan", body);
      if (error) throw error;
      return data as AdvisoryPlan;
    },
    onError: (e: Error) => toast({ title: t("feedback:toasts.errorTitle"), description: e.message, variant: "destructive" }),
  });

  // CO attainment data for improvement suggestions
  const { data: coAttainment = [] } = useQuery<Array<{ co_code: string; co_description: string; avg_score: number | null; num_los: number }>>({
    queryKey: ["co-attainment-feedback"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/reports/co-attainment");
      if (error) throw error;
      return data;
    },
  });

  const lowCOs = coAttainment.filter((co) => co.avg_score !== null && co.avg_score < 50);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {t("feedback:header.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("feedback:header.description")}
          </p>
        </div>

        <Tabs defaultValue="advisory">
          <TabsList>
            <TabsTrigger value="advisory">
              <Brain className="h-4 w-4 mr-1.5" />
              {t("feedback:tabs.advisory")}
            </TabsTrigger>
            <TabsTrigger value="improvement">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              {t("feedback:tabs.improvement")}
            </TabsTrigger>
          </TabsList>

          {/* ─── Advisory Plan Generator ─── */}
          <TabsContent value="advisory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {t("feedback:advisoryForm.title")}
                </CardTitle>
                <CardDescription>
                  {t("feedback:advisoryForm.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    advisoryMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("feedback:advisoryForm.studentName")}</Label>
                      <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder={t("feedback:advisoryForm.studentNamePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("feedback:advisoryForm.weakConcepts")}</Label>
                      <Input
                        value={weakConcepts}
                        onChange={(e) => setWeakConcepts(e.target.value)}
                        placeholder={t("feedback:advisoryForm.weakConceptsPlaceholder")}
                      />
                    </div>
                  </div>

                  <p className="text-sm font-medium text-muted-foreground">{t("feedback:advisoryForm.performanceMetrics")}</p>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      { key: "marks", val: perfMarks, set: setPerfMarks, max: 100 },
                      { key: "attendance", val: perfAttendance, set: setPerfAttendance, max: 100 },
                      { key: "internal", val: perfInternal, set: setPerfInternal, max: 20 },
                      { key: "lab", val: perfLab, set: setPerfLab, max: 25 },
                      { key: "assignments", val: perfAssignments, set: setPerfAssignments, max: 10 },
                      { key: "studyHours", val: perfStudyHours, set: setPerfStudyHours, max: 24 },
                      { key: "mastery", val: perfMastery, set: setPerfMastery, max: 100 },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-xs">{t(`feedback:advisoryForm.${f.key}`)}</Label>
                        <Input type="number" value={f.val} onChange={(e) => f.set(e.target.value)} min={0} max={f.max} />
                      </div>
                    ))}
                  </div>

                  <Button type="submit" disabled={advisoryMutation.isPending}>
                    {advisoryMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("feedback:advisoryForm.generating")}
                      </>
                    ) : (
                      t("feedback:advisoryForm.generate")
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {advisoryMutation.data && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { key: "studyPlan", icon: BookOpen, content: advisoryMutation.data.study_plan },
                  { key: "conceptReinforcement", icon: Brain, content: advisoryMutation.data.concept_reinforcement },
                  { key: "miniProject", icon: TrendingUp, content: advisoryMutation.data.mini_project },
                  { key: "adaptiveSchedule", icon: Calendar, content: advisoryMutation.data.adaptive_schedule },
                ].map(({ key, icon: Icon, content }) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {t(`feedback:resultCards.${key}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Improvement Insights ─── */}
          <TabsContent value="improvement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t("feedback:insights.title")}
                </CardTitle>
                <CardDescription>
                  {t("feedback:insights.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {coAttainment.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("feedback:insights.noData")}</p>
                ) : (
                  <>
                    {lowCOs.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-5 w-5" />
                          <p className="font-medium">{t("feedback:insights.belowThreshold", { count: lowCOs.length })}</p>
                        </div>
                        {lowCOs.map((co) => (
                          <Card key={co.co_code} className="border-amber-200 bg-amber-50/50">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">{co.co_code}</p>
                                  <p className="text-sm text-muted-foreground">{co.co_description}</p>
                                </div>
                                <Badge variant="destructive">{co.avg_score?.toFixed(1)}%</Badge>
                              </div>
                              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                                <p className="font-medium text-foreground">{t("feedback:insights.suggestedActions")}</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                  <li>{t("feedback:insights.action1", { co: co.co_code })}</li>
                                  <li>{t("feedback:insights.action2", { count: co.num_los })}</li>
                                  <li>{t("feedback:insights.action3")}</li>
                                  <li>{t("feedback:insights.action4")}</li>
                                </ul>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <TrendingUp className="h-10 w-10 mx-auto mb-2 text-green-500" />
                        <p className="font-medium text-foreground">{t("feedback:insights.allGood")}</p>
                        <p className="text-sm">{t("feedback:insights.allGoodSub")}</p>
                      </div>
                    )}

                    {/* Full CO table */}
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">{t("feedback:table.coCode")}</th>
                            <th className="px-4 py-2 text-left font-medium">{t("feedback:table.description")}</th>
                            <th className="px-4 py-2 text-right font-medium">{t("feedback:table.los")}</th>
                            <th className="px-4 py-2 text-right font-medium">{t("feedback:table.avgScore")}</th>
                            <th className="px-4 py-2 text-right font-medium">{t("feedback:table.status")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {coAttainment.map((co) => (
                            <tr key={co.co_code}>
                              <td className="px-4 py-2 font-medium">{co.co_code}</td>
                              <td className="px-4 py-2 text-muted-foreground">{co.co_description}</td>
                              <td className="px-4 py-2 text-right">{co.num_los}</td>
                              <td className="px-4 py-2 text-right">{co.avg_score !== null ? `${co.avg_score.toFixed(1)}%` : "—"}</td>
                              <td className="px-4 py-2 text-right">
                                {co.avg_score === null ? (
                                  <Badge variant="outline">{t("feedback:table.noData")}</Badge>
                                ) : co.avg_score >= 70 ? (
                                  <Badge className="bg-green-100 text-green-800">{t("feedback:table.strong")}</Badge>
                                ) : co.avg_score >= 50 ? (
                                  <Badge className="bg-yellow-100 text-yellow-800">{t("feedback:table.moderate")}</Badge>
                                ) : (
                                  <Badge variant="destructive">{t("feedback:table.atRisk")}</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
