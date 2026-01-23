import { useState } from "react";
import { Timer } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Bench405ToolProps {
  onBack: () => void;
}

const Bench405Tool = ({ onBack }: Bench405ToolProps) => {
  const [currentMax, setCurrentMax] = useState("");
  const [trainingAge, setTrainingAge] = useState("");
  const [showResult, setShowResult] = useState(false);

  const canCalculate = currentMax && trainingAge;

  const handleCalculate = () => {
    if (canCalculate) {
      setShowResult(true);
    }
  };

  return (
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <BackButton onClick={onBack} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Timer className="w-5 h-5 text-tool-amber" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">How Long Until I Bench 405?</h1>
        </div>
        <p className="text-muted-foreground">
          Estimate how long it will take to reach a 405 lb bench press based on your current progress.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Your Current Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentMax" className="text-base font-medium">
                Current Bench Max (lbs)
              </Label>
              <Input
                id="currentMax"
                type="number"
                value={currentMax}
                onChange={(e) => setCurrentMax(e.target.value)}
                placeholder="e.g., 275"
                className="mt-2 h-14 text-lg"
              />
            </div>

            <div>
              <Label htmlFor="trainingAge" className="text-base font-medium">
                Years of Training
              </Label>
              <Input
                id="trainingAge"
                type="number"
                value={trainingAge}
                onChange={(e) => setTrainingAge(e.target.value)}
                placeholder="e.g., 3"
                className="mt-2 h-14 text-lg"
                step="0.5"
              />
            </div>

            <Button 
              className="w-full h-12 text-base" 
              disabled={!canCalculate}
              onClick={handleCalculate}
            >
              Calculate
            </Button>
          </CardContent>
        </Card>

        {showResult && (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-2xl font-bold text-foreground">
                I don't fucking know, please stop asking
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Methodology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Projection Model</h4>
              <p className="text-muted-foreground">
                Placeholder: Add your methodology description here.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Assumptions</h4>
              <p className="text-muted-foreground">
                Placeholder: Add your assumptions and limitations here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Bench405Tool;
