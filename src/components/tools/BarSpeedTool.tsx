import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarbellTracker } from "@/components/barbell-tracker/BarbellTracker";
import type { AnalysisResult } from "@/lib/barbell-physics";
import { Gauge, Zap, Ruler } from "lucide-react";

interface BarSpeedToolProps {
  onBack: () => void;
}

const BarSpeedTool = ({ onBack }: BarSpeedToolProps) => {
  const [mass, setMass] = useState<number>(100);
  const [showMassInput, setShowMassInput] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleStartAnalysis = () => {
    if (mass > 0) {
      setShowMassInput(false);
    }
  };

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
  };

  const handleNewAnalysis = () => {
    setAnalysisResult(null);
    setShowMassInput(true);
  };

  // Calculate range of motion from velocity data
  const rangeOfMotion = analysisResult?.velocityDataArray
    ? Math.abs(
        Math.max(...analysisResult.velocityDataArray.map((d) => d.y)) -
        Math.min(...analysisResult.velocityDataArray.map((d) => d.y))
      )
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-muted-foreground hover:text-tool-red"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Bar Speed Analyzer
            </h1>
            <span className="px-2.5 py-1 bg-secondary text-tool-red text-xs font-medium rounded-full">
              Beta
            </span>
          </div>
          <p className="text-muted-foreground">
            Analyze bar velocity and force from video footage
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-tool-red">
          {/* Mass Input */}
          {showMassInput && !analysisResult && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <Settings className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h2 className="text-lg font-medium text-foreground mb-1">
                  Configure Analysis
                </h2>
                <p className="text-muted-foreground text-sm">
                  Enter the total weight on the bar
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mass" className="text-foreground">
                    Bar Weight (kg)
                  </Label>
                  <Input
                    id="mass"
                    type="number"
                    min={1}
                    max={500}
                    value={mass}
                    onChange={(e) => setMass(parseFloat(e.target.value) || 0)}
                    className="text-center text-lg bg-secondary/50 border-border"
                    placeholder="100"
                  />
                  <p className="text-muted-foreground text-xs text-center">
                    Include bar weight (typically 20kg)
                  </p>
                </div>

                <Button
                  onClick={handleStartAnalysis}
                  disabled={!mass || mass <= 0}
                  className="w-full bg-tool-red hover:bg-tool-red/90 text-white"
                >
                  Start Analysis
                </Button>
              </div>
            </div>
          )}

          {/* Barbell Tracker Component */}
          {!showMassInput && !analysisResult && (
            <BarbellTracker
              mass={mass}
              onAnalysisComplete={handleAnalysisComplete}
            />
          )}

          {/* Results */}
          {analysisResult && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-foreground text-center">
                Analysis Complete
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <Gauge className="w-8 h-8 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Mean Velocity
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {analysisResult.meanVelocity.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground text-xs">m/s</p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <Zap className="w-8 h-8 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Peak Force
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {Math.round(analysisResult.peakForce)}
                  </p>
                  <p className="text-muted-foreground text-xs">N</p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <Ruler className="w-8 h-8 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Range of Motion
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {rangeOfMotion.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground text-xs">m</p>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Analyzed {analysisResult.velocityDataArray.length} data points
                from {mass}kg lift
              </div>

              <Button
                variant="outline"
                onClick={handleNewAnalysis}
                className="w-full border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                Analyze Another Lift
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarSpeedTool;
