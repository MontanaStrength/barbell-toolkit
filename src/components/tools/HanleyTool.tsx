import { useState } from "react";
import { Plus, Trash2, Calculator, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HanleyToolProps {
  onBack: () => void;
}

interface Set {
  id: number;
  reps: string;
  intensity: string;
}

const HanleyTool = ({ onBack }: HanleyToolProps) => {
  const [sets, setSets] = useState<Set[]>([
    { id: 1, reps: "", intensity: "" },
  ]);

  // Reverse calculator state
  const [targetStress, setTargetStress] = useState("");
  const [reverseIntensity, setReverseIntensity] = useState("");

  const addSet = () => {
    setSets([...sets, { id: Date.now(), reps: "", intensity: "" }]);
  };

  const removeSet = (id: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((s) => s.id !== id));
    }
  };

  const updateSet = (id: number, field: "reps" | "intensity", value: string) => {
    setSets(sets.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Formula: Score = Reps * (100 / (100 - Intensity))^2
  const calculateSetScore = (reps: number, intensity: number): number => {
    if (intensity >= 100) return 0;
    return reps * Math.pow(100 / (100 - intensity), 2);
  };

  const totalScore = sets.reduce((acc, set) => {
    const reps = parseFloat(set.reps);
    const intensity = parseFloat(set.intensity);
    if (isNaN(reps) || isNaN(intensity)) return acc;
    return acc + calculateSetScore(reps, intensity);
  }, 0);

  const getStressLevel = (score: number) => {
    if (score < 400) return { label: "Light", color: "text-tool-emerald" };
    if (score < 500) return { label: "Moderate", color: "text-tool-yellow" };
    if (score < 600) return { label: "Moderate High", color: "text-orange-400" };
    if (score < 700) return { label: "High", color: "text-tool-red" };
    return { label: "You sure about this?", color: "text-tool-purple" };
  };

  // Reverse calculator: Reps = TargetScore / (100 / (100 - Intensity))^2
  const calculateReverseReps = () => {
    const target = parseFloat(targetStress);
    const intensity = parseFloat(reverseIntensity);
    if (isNaN(target) || isNaN(intensity) || intensity >= 100) return null;
    return target / Math.pow(100 / (100 - intensity), 2);
  };

  const reverseReps = calculateReverseReps();
  const stressLevel = getStressLevel(totalScore);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <BackButton onClick={onBack} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Hanley Fatigue Metric
          </h1>
          <p className="text-muted-foreground">
            Calculate normalized stress scores based on volume and intensity
          </p>
        </div>

        <Tabs defaultValue="calculator" className="space-y-6">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger
              value="calculator"
              className="data-[state=active]:bg-tool-purple/10 data-[state=active]:text-tool-purple"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculator
            </TabsTrigger>
            <TabsTrigger
              value="reverse"
              className="data-[state=active]:bg-tool-purple/10 data-[state=active]:text-tool-purple"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reverse Calculator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-tool-purple">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-foreground">
                  Session Sets
                </h2>
                <Button
                  onClick={addSet}
                  size="sm"
                  variant="outline"
                  className="border-border text-muted-foreground hover:text-tool-purple hover:border-tool-purple/50"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Set
                </Button>
              </div>

              <div className="space-y-3">
                {sets.map((set, index) => (
                  <div
                    key={set.id}
                    className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-border"
                  >
                    <span className="text-muted-foreground font-medium w-14 text-sm">
                      Set {index + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Reps</Label>
                        <Input
                          type="number"
                          value={set.reps}
                          onChange={(e) => updateSet(set.id, "reps", e.target.value)}
                          placeholder="8"
                          className="bg-secondary border-border focus:border-tool-purple h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Intensity %</Label>
                        <Input
                          type="number"
                          value={set.intensity}
                          onChange={(e) => updateSet(set.id, "intensity", e.target.value)}
                          placeholder="75"
                          className="bg-secondary border-border focus:border-tool-purple h-9"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSet(set.id)}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={sets.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {totalScore > 0 && (
                <div className="mt-6 p-5 bg-secondary/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm mb-1">
                        Total Stress Score
                      </p>
                      <p className="text-3xl font-semibold text-tool-purple">
                        {totalScore.toFixed(1)}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full bg-secondary border border-border`}>
                      <span className={`font-medium ${stressLevel.color}`}>
                        {stressLevel.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Zone Reference</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div className="p-2 rounded bg-tool-emerald/10 border border-tool-emerald/20 text-center">
                    <p className="text-tool-emerald font-medium">Light</p>
                    <p className="text-muted-foreground text-xs">&lt; 400</p>
                  </div>
                  <div className="p-2 rounded bg-tool-yellow/10 border border-tool-yellow/20 text-center">
                    <p className="text-tool-yellow font-medium">Moderate</p>
                    <p className="text-muted-foreground text-xs">400–499</p>
                  </div>
                  <div className="p-2 rounded bg-orange-400/10 border border-orange-400/20 text-center">
                    <p className="text-orange-400 font-medium">Mod. High</p>
                    <p className="text-muted-foreground text-xs">500–599</p>
                  </div>
                  <div className="p-2 rounded bg-tool-red/10 border border-tool-red/20 text-center">
                    <p className="text-tool-red font-medium">High</p>
                    <p className="text-muted-foreground text-xs">600–699</p>
                  </div>
                  <div className="p-2 rounded bg-tool-purple/10 border border-tool-purple/20 text-center">
                    <p className="text-tool-purple font-medium">Extreme</p>
                    <p className="text-muted-foreground text-xs">≥ 700</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reverse" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-tool-purple">
              <h2 className="text-lg font-medium text-foreground mb-2">
                Reverse Calculator
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Enter your target stress score and intensity to calculate required reps
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Target Stress Score</Label>
                  <Input
                    type="number"
                    value={targetStress}
                    onChange={(e) => setTargetStress(e.target.value)}
                    placeholder="400"
                    className="bg-secondary border-border focus:border-tool-purple"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Intensity %</Label>
                  <Input
                    type="number"
                    value={reverseIntensity}
                    onChange={(e) => setReverseIntensity(e.target.value)}
                    placeholder="80"
                    className="bg-secondary border-border focus:border-tool-purple"
                  />
                </div>
              </div>

              {reverseReps !== null && (
                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <p className="text-muted-foreground text-sm mb-1">
                    Required Reps
                  </p>
                  <p className="text-3xl font-semibold text-tool-purple">
                    {reverseReps.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HanleyTool;
