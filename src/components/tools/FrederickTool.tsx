import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FrederickToolProps {
  onBack: () => void;
}

interface Set {
  id: number;
  intensity: string;
  reps: string;
  rir: string;
}

const FrederickTool = ({ onBack }: FrederickToolProps) => {
  const [sets, setSets] = useState<Set[]>([
    { id: 1, intensity: "", reps: "", rir: "" },
  ]);

  const addSet = () => {
    setSets([...sets, { id: Date.now(), intensity: "", reps: "", rir: "" }]);
  };

  const removeSet = (id: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((s) => s.id !== id));
    }
  };

  const updateSet = (id: number, field: keyof Omit<Set, "id">, value: string) => {
    setSets(sets.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Formula: Exertion Load = Reps * Intensity * e^(-0.215 * RIR)
  const calculateSetLoad = (reps: number, intensity: number, rir: number): number => {
    return reps * (intensity / 100) * Math.exp(-0.215 * rir);
  };

  const totalLoad = sets.reduce((acc, set) => {
    const reps = parseFloat(set.reps);
    const intensity = parseFloat(set.intensity);
    const rir = parseFloat(set.rir);
    if (isNaN(reps) || isNaN(intensity) || isNaN(rir)) return acc;
    return acc + calculateSetLoad(reps, intensity, rir);
  }, 0);

  const getLoadLevel = (load: number) => {
    if (load < 10) return { label: "Light", color: "text-tool-emerald" };
    if (load < 25) return { label: "Moderate", color: "text-tool-yellow" };
    if (load < 40) return { label: "Heavy", color: "text-orange-400" };
    return { label: "Very Heavy", color: "text-tool-red" };
  };

  const loadLevel = getLoadLevel(totalLoad);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-tool-yellow hover:text-tool-yellow hover:bg-tool-yellow/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-tool-yellow text-glow-yellow mb-2">
            Frederick Metabolic Stress
          </h1>
          <p className="text-muted-foreground">
            Quantify metabolic stress using volume, intensity, and proximity to failure
          </p>
        </div>

        <div className="bg-card border border-tool-yellow/20 rounded-lg p-6 glow-yellow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-tool-yellow">
              Session Sets
            </h2>
            <Button
              onClick={addSet}
              size="sm"
              className="bg-tool-yellow/20 text-tool-yellow hover:bg-tool-yellow/30 border border-tool-yellow/30"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Set
            </Button>
          </div>

          <div className="space-y-3">
            {sets.map((set, index) => (
              <div
                key={set.id}
                className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-tool-yellow/10"
              >
                <span className="text-tool-yellow font-medium w-16">
                  Set {index + 1}
                </span>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Intensity %</Label>
                    <Input
                      type="number"
                      value={set.intensity}
                      onChange={(e) => updateSet(set.id, "intensity", e.target.value)}
                      placeholder="75"
                      className="bg-secondary border-tool-yellow/30 focus:border-tool-yellow h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Reps</Label>
                    <Input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(set.id, "reps", e.target.value)}
                      placeholder="8"
                      className="bg-secondary border-tool-yellow/30 focus:border-tool-yellow h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">RIR</Label>
                    <Input
                      type="number"
                      value={set.rir}
                      onChange={(e) => updateSet(set.id, "rir", e.target.value)}
                      placeholder="2"
                      className="bg-secondary border-tool-yellow/30 focus:border-tool-yellow h-9"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSet(set.id)}
                  className="text-muted-foreground hover:text-tool-red hover:bg-tool-red/10"
                  disabled={sets.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {totalLoad > 0 && (
            <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Total Session Load
                  </p>
                  <p className="text-4xl font-bold text-tool-yellow text-glow-yellow">
                    {totalLoad.toFixed(2)}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full bg-tool-yellow/10 border border-tool-yellow/30`}>
                  <span className={`font-semibold ${loadLevel.color}`}>
                    {loadLevel.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-tool-yellow/10">
            <h3 className="text-sm font-medium text-tool-yellow mb-2">Formula</h3>
            <p className="text-muted-foreground text-sm font-mono">
              Exertion Load = Reps × Intensity × e<sup>(-0.215 × RIR)</sup>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrederickTool;
