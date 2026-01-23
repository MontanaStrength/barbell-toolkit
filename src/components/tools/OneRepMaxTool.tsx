import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";

interface OneRepMaxToolProps {
  onBack: () => void;
}

type UnitSystem = "kg" | "lbs";

// 1RM Formulas
const formulas = {
  epley: (weight: number, reps: number) => weight * (1 + reps / 30),
  brzycki: (weight: number, reps: number) => weight * (36 / (37 - reps)),
  lander: (weight: number, reps: number) => (100 * weight) / (101.3 - 2.67123 * reps),
  lombardi: (weight: number, reps: number) => weight * Math.pow(reps, 0.1),
  mayhew: (weight: number, reps: number) => (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps)),
  oconner: (weight: number, reps: number) => weight * (1 + reps / 40),
  wathan: (weight: number, reps: number) => (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps)),
};

const formulaInfo = [
  { id: "epley", name: "Epley", description: "Most popular, good for moderate reps" },
  { id: "brzycki", name: "Brzycki", description: "Accurate for 1-10 reps" },
  { id: "lander", name: "Lander", description: "Conservative estimates" },
  { id: "lombardi", name: "Lombardi", description: "Simple power formula" },
  { id: "mayhew", name: "Mayhew", description: "Football player derived" },
  { id: "oconner", name: "O'Conner", description: "Similar to Epley, slightly lower" },
  { id: "wathan", name: "Wathan", description: "Good for higher rep ranges" },
];

const OneRepMaxTool = ({ onBack }: OneRepMaxToolProps) => {
  const [weight, setWeight] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("lbs");
  const [showFormulas, setShowFormulas] = useState(false);

  // Default placeholder values
  const defaultWeight = 225;
  const defaultReps = 5;

  const weightNum = weight ? parseFloat(weight) : defaultWeight;
  const repsNum = reps ? parseInt(reps) : defaultReps;

  const isValid = weightNum > 0 && repsNum >= 1 && repsNum <= 15;

  const results = isValid
    ? Object.entries(formulas).map(([key, formula]) => ({
        id: key,
        name: formulaInfo.find((f) => f.id === key)?.name || key,
        value: formula(weightNum, repsNum),
      }))
    : [];

  const average = results.length > 0
    ? results.reduce((sum, r) => sum + r.value, 0) / results.length
    : 0;

  // Generate percentage table
  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <BackButton onClick={onBack} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            1RM Calculator
          </h1>
          <p className="text-muted-foreground">
            Estimate your one-rep max from submaximal lifts using proven formulas
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-tool-orange">
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="w-5 h-5 text-tool-orange" />
              <h2 className="text-lg font-medium text-foreground">Enter Your Lift</h2>
            </div>

            <div className="space-y-5">
              {/* Unit Toggle */}
              <div className="flex justify-center gap-1 p-1 bg-secondary/50 rounded-lg border border-border">
                <Toggle
                  pressed={unitSystem === "kg"}
                  onPressedChange={() => setUnitSystem("kg")}
                  className="flex-1 data-[state=on]:bg-tool-orange data-[state=on]:text-primary-foreground"
                >
                  kg
                </Toggle>
                <Toggle
                  pressed={unitSystem === "lbs"}
                  onPressedChange={() => setUnitSystem("lbs")}
                  className="flex-1 data-[state=on]:bg-tool-orange data-[state=on]:text-primary-foreground"
                >
                  lbs
                </Toggle>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight" className="text-foreground">
                  Weight Lifted ({unitSystem})
                </Label>
                <Input
                  id="weight"
                  type="number"
                  min={1}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={unitSystem === "lbs" ? "225" : "100"}
                  className="text-lg bg-secondary/50 border-border focus:border-tool-orange"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reps" className="text-foreground">
                  Reps Completed (1-15)
                </Label>
                <Input
                  id="reps"
                  type="number"
                  min={1}
                  max={15}
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="5"
                  className="text-lg bg-secondary/50 border-border focus:border-tool-orange"
                />
                <p className="text-xs text-muted-foreground">
                  Most accurate with 1-10 reps
                </p>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Estimated 1RM
            </h2>

            {isValid ? (
              <div className="space-y-4">
                {/* Average Result */}
                <div className="p-5 bg-secondary/50 rounded-lg border border-border text-center">
                  <p className="text-muted-foreground text-sm mb-1">Average Estimate</p>
                  <p className="text-4xl font-bold text-tool-orange">
                    {Math.round(average)}
                    <span className="text-lg text-muted-foreground ml-1">{unitSystem}</span>
                  </p>
                </div>

                {/* Individual Formulas */}
                <button
                  onClick={() => setShowFormulas(!showFormulas)}
                  className="w-full text-sm text-tool-orange hover:underline flex items-center justify-center gap-1"
                >
                  <Info className="w-4 h-4" />
                  {showFormulas ? "Hide" : "Show"} individual formulas
                </button>

                {showFormulas && (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <div
                        key={result.id}
                        className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg border border-border"
                      >
                        <span className="text-sm text-foreground">{result.name}</span>
                        <span className="font-mono font-semibold text-foreground">
                          {Math.round(result.value)} {unitSystem}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                Enter weight and reps to calculate
              </div>
            )}
          </div>
        </div>

        {/* Percentage Table */}
        {isValid && (
          <div className="mt-6 bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Training Load Table
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Based on your estimated 1RM of {Math.round(average)} {unitSystem}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">%</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Weight</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Use Case</th>
                  </tr>
                </thead>
                <tbody>
                  {percentages.map((pct, idx) => {
                    const loadWeight = Math.round(average * (pct / 100));
                    const useCase = 
                      pct >= 95 ? "Max effort / Testing" :
                      pct >= 85 ? "Strength (1-3 reps)" :
                      pct >= 75 ? "Strength/Hypertrophy (4-6 reps)" :
                      pct >= 65 ? "Hypertrophy (8-12 reps)" :
                      "Endurance / Warmup";
                    
                    return (
                      <tr 
                        key={pct} 
                        className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-secondary/20' : ''}`}
                      >
                        <td className="py-3 px-4 font-semibold text-tool-orange">{pct}%</td>
                        <td className="py-3 px-4 font-mono text-foreground">
                          {loadWeight} {unitSystem}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{useCase}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Formula Reference */}
        <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">About the Formulas</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This calculator uses 7 peer-reviewed formulas (Epley, Brzycki, Lander, Lombardi, Mayhew, O'Conner, Wathan) 
            and averages them for the most reliable estimate. Accuracy decreases above 10 reps.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OneRepMaxTool;
