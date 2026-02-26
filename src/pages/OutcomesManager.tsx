import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Target, BookMarked, Lightbulb } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function OutcomesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // PO state
  const [poOpen, setPoOpen] = useState(false);
  const [poCode, setPoCode] = useState("");
  const [poDesc, setPoDesc] = useState("");

  // CO state
  const [coOpen, setCoOpen] = useState(false);
  const [coCode, setCoCode] = useState("");
  const [coDesc, setCoDesc] = useState("");
  const [coPoId, setCoPoId] = useState("");

  // LO state
  const [loOpen, setLoOpen] = useState(false);
  const [loCode, setLoCode] = useState("");
  const [loDesc, setLoDesc] = useState("");
  const [loCoId, setLoCoId] = useState("");

  const { data: pos = [] } = useQuery({
    queryKey: ["program_outcomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_outcomes").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: cos = [] } = useQuery({
    queryKey: ["course_outcomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_outcomes").select("*, program_outcomes(code)").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: los = [] } = useQuery({
    queryKey: ["learning_outcomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_outcomes").select("*, course_outcomes(code)").order("code");
      if (error) throw error;
      return data;
    },
  });

  const createPO = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("program_outcomes").insert({ code: poCode, description: poDesc, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program_outcomes"] });
      setPoOpen(false); setPoCode(""); setPoDesc("");
      toast({ title: "Program Outcome created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createCO = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_outcomes").insert({ code: coCode, description: coDesc, program_outcome_id: coPoId, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course_outcomes"] });
      setCoOpen(false); setCoCode(""); setCoDesc(""); setCoPoId("");
      toast({ title: "Course Outcome created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLO = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("learning_outcomes").insert({ code: loCode, description: loDesc, course_outcome_id: loCoId, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] });
      setLoOpen(false); setLoCode(""); setLoDesc(""); setLoCoId("");
      toast({ title: "Learning Outcome created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePO = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program_outcomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program_outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["course_outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] });
    },
  });

  const deleteCO = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_outcomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course_outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] });
    },
  });

  const deleteLO = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_outcomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Outcomes Management</h2>
          <p className="text-muted-foreground">Define PO → CO → LO hierarchy for your courses</p>
        </div>

        <Tabs defaultValue="po">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="po" className="gap-1"><Target className="h-4 w-4" />PO</TabsTrigger>
            <TabsTrigger value="co" className="gap-1"><BookMarked className="h-4 w-4" />CO</TabsTrigger>
            <TabsTrigger value="lo" className="gap-1"><Lightbulb className="h-4 w-4" />LO</TabsTrigger>
          </TabsList>

          {/* Program Outcomes */}
          <TabsContent value="po" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Program Outcomes</h3>
              <Dialog open={poOpen} onOpenChange={setPoOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add PO</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Program Outcome</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createPO.mutate(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Code (e.g. PO1)</Label>
                      <Input value={poCode} onChange={(e) => setPoCode(e.target.value)} required placeholder="PO1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={poDesc} onChange={(e) => setPoDesc(e.target.value)} placeholder="Describe the program outcome..." rows={3} />
                    </div>
                    <Button type="submit" className="w-full" disabled={createPO.isPending}>Create</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {pos.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No program outcomes yet.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {pos.map((po) => (
                  <Card key={po.id}>
                    <CardContent className="flex items-start justify-between pt-4">
                      <div>
                        <p className="font-semibold text-primary">{po.code}</p>
                        <p className="text-sm text-muted-foreground mt-1">{po.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deletePO.mutate(po.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Course Outcomes */}
          <TabsContent value="co" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Course Outcomes</h3>
              <Dialog open={coOpen} onOpenChange={setCoOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add CO</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Course Outcome</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createCO.mutate(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Code (e.g. CO1)</Label>
                      <Input value={coCode} onChange={(e) => setCoCode(e.target.value)} required placeholder="CO1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Linked Program Outcome</Label>
                      <Select value={coPoId} onValueChange={setCoPoId} required>
                        <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                        <SelectContent>
                          {pos.map((po) => (
                            <SelectItem key={po.id} value={po.id}>{po.code} – {po.description?.slice(0, 40)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={coDesc} onChange={(e) => setCoDesc(e.target.value)} placeholder="Describe the course outcome..." rows={3} />
                    </div>
                    <Button type="submit" className="w-full" disabled={createCO.isPending || !coPoId}>Create</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {cos.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No course outcomes yet. Create a PO first.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {cos.map((co: any) => (
                  <Card key={co.id}>
                    <CardContent className="flex items-start justify-between pt-4">
                      <div>
                        <p className="font-semibold text-primary">{co.code}</p>
                        <p className="text-xs text-accent font-medium">→ {co.program_outcomes?.code}</p>
                        <p className="text-sm text-muted-foreground mt-1">{co.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteCO.mutate(co.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Learning Outcomes */}
          <TabsContent value="lo" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Learning Outcomes</h3>
              <Dialog open={loOpen} onOpenChange={setLoOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add LO</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Learning Outcome</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createLO.mutate(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Code (e.g. LO1)</Label>
                      <Input value={loCode} onChange={(e) => setLoCode(e.target.value)} required placeholder="LO1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Linked Course Outcome</Label>
                      <Select value={loCoId} onValueChange={setLoCoId} required>
                        <SelectTrigger><SelectValue placeholder="Select CO" /></SelectTrigger>
                        <SelectContent>
                          {cos.map((co: any) => (
                            <SelectItem key={co.id} value={co.id}>{co.code} – {co.description?.slice(0, 40)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={loDesc} onChange={(e) => setLoDesc(e.target.value)} placeholder="Describe the learning outcome..." rows={3} />
                    </div>
                    <Button type="submit" className="w-full" disabled={createLO.isPending || !loCoId}>Create</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {los.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No learning outcomes yet. Create a CO first.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {los.map((lo: any) => (
                  <Card key={lo.id}>
                    <CardContent className="flex items-start justify-between pt-4">
                      <div>
                        <p className="font-semibold text-primary">{lo.code}</p>
                        <p className="text-xs text-accent font-medium">→ {lo.course_outcomes?.code}</p>
                        <p className="text-sm text-muted-foreground mt-1">{lo.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteLO.mutate(lo.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
