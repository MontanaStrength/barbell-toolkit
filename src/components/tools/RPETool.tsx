import { useState } from "react";
import { Calculator, Target, TableIcon } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rpeTable } from "@/lib/rpe-table";

interface RPEToolProps {
  onBack: () => void;
}

const RPETool = ({ onBack }: RPEToolProps) => {
  // Estimator state
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");

  // Load Planner state
  const [maxWeight, setMaxWeight] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetRpe, setTargetRpe] = useState("");

  // Default placeholder values
  const defaultWeight = 225;
  const defaultReps = 5;
  const defaultRpe = 8;
  const defaultMaxWeight = 315;

  // Calculate e1RM
  const calculateE1RM = () => {
    const w = weight ? parseFloat(weight) : defaultWeight;
    const r = reps ? parseFloat(reps) : defaultReps;
    const e = rpe ? parseFloat(rpe) : defaultRpe;
    if (isNaN(w) || isNaN(r) || isNaN(e)) return null;
    return w * (1 + (r + (10 - e) * 0.5) / 30);
  };

  // Calculate Load (reverse e1RM formula)
  const calculateLoad = () => {
    const max = maxWeight ? parseFloat(maxWeight) : defaultMaxWeight;
    const r = targetReps ? parseFloat(targetReps) : defaultReps;
    const e = targetRpe ? parseFloat(targetRpe) : defaultRpe;
    if (isNaN(max) || isNaN(r) || isNaN(e)) return null;
    return max / (1 + (r + (10 - e) * 0.5) / 30);
  };

  const e1rm = calculateE1RM();
  const load = calculateLoad();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <BackButton onClick={onBack} />

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
