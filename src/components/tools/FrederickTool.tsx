import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FrederickToolProps {
  onBack: () => void;
}

interface Set {
  id: number;
  intensity: string;
  reps: string;
  rpe: string;
}

const FrederickTool = ({ onBack }: FrederickToolProps) => {
  const [sets, setSets] = useState<Set[]>([
    { id: 1, intensity: "", reps: "", rpe: "" },
  ]);

  const addSet = () => {
    const firstSet = sets[0];
    setSets([...sets, { 
      id: Date.now(), 
      intensity: firstSet?.intensity || "", 
      reps: firstSet?.reps || "", 
      rpe: firstSet?.rpe || "" 
    }]);
  };

  const removeSet = (id: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((s) => s.id !== id));
    }
  };

  const updateSet = (id: number, field: keyof Omit<Set, "id">, value: string) => {
    setSets(sets.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Correct formula: Loop through each rep, sum e^(-0.215 * (RIR + Reps - i)), multiply by mass
  const calculateSetLoad = (reps: number, intensity: number, rir: number): number => {
    let setLoad = 0;
    for (let i = 1; i <= reps; i++) {
      const repValue = Math.exp(-0.215 * (rir + reps - i));
      setLoad += repValue;
    }
    return intensity * setLoad;
  };

  // Default placeholder values
  const defaultIntensity = 75;
  const defaultReps = 8;
  const defaultRpe = 8;

  const totalLoad = sets.reduce((acc, set) => {
    const reps = set.reps ? parseFloat(set.reps) : defaultReps;
    const intensity = set.intensity ? parseFloat(set.intensity) : defaultIntensity;
    const rpe = set.rpe ? parseFloat(set.rpe) : defaultRpe;
    if (isNaN(reps) || isNaN(intensity) || isNaN(rpe)) return acc;
    // Convert RPE to RIR for calculation: RIR = 10 - RPE
    const rir = 10 - rpe;
    return acc + calculateSetLoad(reps, intensity, rir);
  }, 0);

  const getLoadLevel = (load: number) => {
    if (load < 500) return { label: "Light", color: "text-tool-emerald" };
    if (load < 650) return { label: "Moderate", color: "text-tool-yellow" };
    if (load < 800) return { label: "Moderate High", color: "text-orange-400" };
    if (load < 1100) return { label: "High", color: "text-tool-red" };
    return { label: "You sure about this?", color: "text-tool-purple" };
  };

  const loadLevel = getLoadLevel(totalLoad);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <BackButton onClick={onBack} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Frederick Metabolic Stress
          </h1>
          <p className="text-muted-foreground">
            Quantify metabolic stress using volume, intensity, and proximity to failure
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-tool-yellow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-foreground">
              Session Sets
            </h2>
            <Button
              onClick={addSet}
              size="sm"
              variant="outline"
              className="border-border text-muted-foreground hover:text-tool-yellow hover:border-tool-yellow/50"
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
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Intensity %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={set.intensity}
                      onChange={(e) => updateSet(set.id, "intensity", e.target.value)}
                      placeholder="75"
                      className="bg-secondary border-border focus:border-tool-yellow h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Reps</Label>
                    <Input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(set.id, "reps", e.target.value)}
                      placeholder="8"
                      className="bg-secondary border-border focus:border-tool-yellow h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">RPE</Label>
                    <Input
                      type="number"
                      min="4"
                      max="10"
                      step="0.5"
                      value={set.rpe}
                      onChange={(e) => updateSet(set.id, "rpe", e.target.value)}
                      placeholder="8"
                      className="bg-secondary border-border focus:border-tool-yellow h-9"
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

          {totalLoad > 0 && (
            <div className="mt-6 p-5 bg-secondary/50 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Total Session Load
                  </p>
                  <p className="text-3xl font-semibold text-tool-yellow">
                    {totalLoad.toFixed(2)}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full bg-secondary border border-border`}>
                  <span className={`font-medium ${loadLevel.color}`}>
                    {loadLevel.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">Zone Reference</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-lg bg-tool-emerald/10 border border-tool-emerald/20 text-center">
                <p className="text-tool-emerald font-semibold text-base">Light</p>
                <p className="text-muted-foreground text-sm mt-1">&lt; 500</p>
              </div>
              <div className="p-4 rounded-lg bg-tool-yellow/10 border border-tool-yellow/20 text-center">
                <p className="text-tool-yellow font-semibold text-base">Moderate</p>
                <p className="text-muted-foreground text-sm mt-1">500–649</p>
              </div>
              <div className="p-4 rounded-lg bg-orange-400/10 border border-orange-400/20 text-center">
                <p className="text-orange-400 font-semibold text-base">Mod. High</p>
                <p className="text-muted-foreground text-sm mt-1">650–799</p>
              </div>
              <div className="p-4 rounded-lg bg-tool-red/10 border border-tool-red/20 text-center">
                <p className="text-tool-red font-semibold text-base">High</p>
                <p className="text-muted-foreground text-sm mt-1">800–1099</p>
              </div>
              <div className="p-4 rounded-lg bg-tool-purple/10 border border-tool-purple/20 text-center">
                <p className="text-tool-purple font-semibold text-sm">Tread Carefully</p>
                <p className="text-muted-foreground text-sm mt-1">≥ 1100</p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Formula</h3>
            <p className="text-muted-foreground text-sm font-mono">
              Load = Mass × Σ e<sup>(-0.215 × (RIR + Reps - i))</sup>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrederickTool;
