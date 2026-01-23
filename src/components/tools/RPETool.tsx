import { useState } from "react";
import { ArrowLeft, Calculator, Target, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RPEToolProps {
  onBack: () => void;
}

// RPE percentage table data
const rpeTable: Record<number, Record<number, number>> = {
  10: { 1: 100, 2: 95.5, 3: 92.2, 4: 89.2, 5: 86.3, 6: 83.7, 7: 81.1, 8: 78.6, 9: 76.2, 10: 73.9, 11: 71.7, 12: 69.4 },
  9.5: { 1: 97.8, 2: 93.9, 3: 90.7, 4: 87.8, 5: 85.0, 6: 82.4, 7: 79.9, 8: 77.4, 9: 75.1, 10: 72.8, 11: 70.6, 12: 68.4 },
  9: { 1: 95.5, 2: 92.2, 3: 89.2, 4: 86.3, 5: 83.7, 6: 81.1, 7: 78.6, 8: 76.2, 9: 73.9, 10: 71.7, 11: 69.4, 12: 67.4 },
  8.5: { 1: 93.9, 2: 90.7, 3: 87.8, 4: 85.0, 5: 82.4, 6: 79.9, 7: 77.4, 8: 75.1, 9: 72.8, 10: 70.6, 11: 68.4, 12: 66.4 },
  8: { 1: 92.2, 2: 89.2, 3: 86.3, 4: 83.7, 5: 81.1, 6: 78.6, 7: 76.2, 8: 73.9, 9: 71.7, 10: 69.4, 11: 67.4, 12: 65.4 },
  7.5: { 1: 90.7, 2: 87.8, 3: 85.0, 4: 82.4, 5: 79.9, 6: 77.4, 7: 75.1, 8: 72.8, 9: 70.6, 10: 68.4, 11: 66.4, 12: 64.4 },
  7: { 1: 89.2, 2: 86.3, 3: 83.7, 4: 81.1, 5: 78.6, 6: 76.2, 7: 73.9, 8: 71.7, 9: 69.4, 10: 67.4, 11: 65.4, 12: 63.4 },
  6.5: { 1: 87.8, 2: 85.0, 3: 82.4, 4: 79.9, 5: 77.4, 6: 75.1, 7: 72.8, 8: 70.6, 9: 68.4, 10: 66.4, 11: 64.4, 12: 62.4 },
  6: { 1: 86.3, 2: 83.7, 3: 81.1, 4: 78.6, 5: 76.2, 6: 73.9, 7: 71.7, 8: 69.4, 9: 67.4, 10: 65.4, 11: 63.4, 12: 61.4 },
};

const RPETool = ({ onBack }: RPEToolProps) => {
  // Estimator state
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");

  // Load Planner state
  const [maxWeight, setMaxWeight] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetRpe, setTargetRpe] = useState("");

  // Calculate e1RM
  const calculateE1RM = () => {
    const w = parseFloat(weight);
    const r = parseFloat(reps);
    const e = parseFloat(rpe);
    if (isNaN(w) || isNaN(r) || isNaN(e)) return null;
    return w * (1 + (r + (10 - e) * 0.5) / 30);
  };

  // Calculate Load (reverse e1RM formula)
  const calculateLoad = () => {
    const max = parseFloat(maxWeight);
    const r = parseFloat(targetReps);
    const e = parseFloat(targetRpe);
    if (isNaN(max) || isNaN(r) || isNaN(e)) return null;
    return max / (1 + (r + (10 - e) * 0.5) / 30);
  };

  const e1rm = calculateE1RM();
  const load = calculateLoad();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-muted-foreground hover:text-tool-blue"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            RPE Tools
          </h1>
          <p className="text-muted-foreground">
            Calculate and plan your training loads using Rate of Perceived Exertion
          </p>
        </div>

        <Tabs defaultValue="estimator" className="space-y-6">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger
              value="estimator"
              className="data-[state=active]:bg-tool-blue/10 data-[state=active]:text-tool-blue"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Estimator
            </TabsTrigger>
            <TabsTrigger
              value="planner"
              className="data-[state=active]:bg-tool-blue/10 data-[state=active]:text-tool-blue"
            >
              <Target className="w-4 h-4 mr-2" />
              Load Planner
            </TabsTrigger>
            <TabsTrigger
              value="table"
              className="data-[state=active]:bg-tool-blue/10 data-[state=active]:text-tool-blue"
            >
              <TableIcon className="w-4 h-4 mr-2" />
              Reference Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estimator" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-tool-blue">
              <h2 className="text-lg font-medium text-foreground mb-4">
                e1RM Estimator
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Weight (lbs/kg)</Label>
                  <Input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="225"
                    className="bg-secondary border-border focus:border-tool-blue"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Reps</Label>
                  <Input
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    placeholder="5"
                    className="bg-secondary border-border focus:border-tool-blue"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">RPE (6-10)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="6"
                    max="10"
                    value={rpe}
                    onChange={(e) => setRpe(e.target.value)}
                    placeholder="8"
                    className="bg-secondary border-border focus:border-tool-blue"
                  />
                </div>
              </div>

              {e1rm && (
                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <p className="text-muted-foreground text-sm mb-1">
                    Estimated 1 Rep Max
                  </p>
                  <p className="text-4xl font-semibold text-tool-blue">
                    {e1rm.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="planner" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-tool-blue">
              <h2 className="text-lg font-medium text-foreground mb-4">
                Load Planner
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Your Max</Label>
                  <Input
                    type="number"
                    value={maxWeight}
                    onChange={(e) => setMaxWeight(e.target.value)}
                    placeholder="315"
                    className="bg-secondary border-border focus:border-tool-blue"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Target Reps</Label>
                  <Input
                    type="number"
                    value={targetReps}
                    onChange={(e) => setTargetReps(e.target.value)}
                    placeholder="5"
                    className="bg-secondary border-border focus:border-tool-blue"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Target RPE</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="6"
                    max="10"
                    value={targetRpe}
                    onChange={(e) => setTargetRpe(e.target.value)}
                    placeholder="8"
                    className="bg-secondary border-border focus:border-tool-blue"
                  />
                </div>
              </div>

              {load && (
                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <p className="text-muted-foreground text-sm mb-1">
                    Recommended Load
                  </p>
                  <p className="text-4xl font-semibold text-tool-blue">
                    {load.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="table" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-tool-blue overflow-x-auto">
              <h2 className="text-lg font-medium text-foreground mb-4">
                RPE Reference Table
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-tool-blue font-medium">RPE</th>
                    <th colSpan={12} className="text-center p-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                      Reps
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="p-2"></th>
                    {[...Array(12)].map((_, i) => (
                      <th key={i} className="text-center p-2 text-foreground font-semibold">
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(rpeTable)
                    .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
                    .map(([rpeVal, reps], index) => (
                    <tr 
                      key={rpeVal} 
                      className={`border-b border-border/50 hover:bg-tool-blue/15 transition-colors ${
                        index % 2 === 0 ? 'bg-secondary/60' : 'bg-transparent'
                      }`}
                    >
                      <td className="p-2 font-medium text-tool-blue">{rpeVal}</td>
                      {Object.values(reps).map((pct, i) => (
                        <td key={i} className="text-center p-2 text-foreground">
                          {pct}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RPETool;
