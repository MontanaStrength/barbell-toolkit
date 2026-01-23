import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface PrelepinToolProps {
  onBack: () => void;
}

const PrelepinTool = ({ onBack }: PrelepinToolProps) => {
  const [intensity, setIntensity] = useState([75]);

  const getRecommendation = (value: number) => {
    if (value < 70) {
      return {
        sets: "3-6",
        reps: "6-12",
        totalVolume: "18-72",
        zone: "Hypertrophy Zone",
        description: "Higher volume work for muscle building and endurance",
      };
    }
    if (value < 80) {
      return {
        sets: "3-5",
        reps: "4-6",
        totalVolume: "12-30",
        zone: "Strength Zone",
        description: "Balanced volume for strength development",
      };
    }
    if (value < 90) {
      return {
        sets: "4-8",
        reps: "2-4",
        totalVolume: "8-32",
        zone: "Power Zone",
        description: "Heavy work for maximal strength",
      };
    }
    return {
      sets: "5-10",
      reps: "1-2",
      totalVolume: "5-20",
      zone: "Peaking Zone",
      description: "Near-maximal training for competition prep",
    };
  };

  const recommendation = getRecommendation(intensity[0]);

  const getZoneColor = (value: number) => {
    if (value < 70) return "text-tool-blue";
    if (value < 80) return "text-tool-emerald";
    if (value < 90) return "text-tool-yellow";
    return "text-tool-red";
  };

  const zoneColor = getZoneColor(intensity[0]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-tool-emerald hover:text-tool-emerald hover:bg-tool-emerald/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-tool-emerald text-glow-emerald mb-2">
            Better Prilepin's Table
          </h1>
          <p className="text-muted-foreground">
            Dynamic recommendations based on training intensity
          </p>
        </div>

        <div className="bg-card border border-tool-emerald/20 rounded-lg p-6 glow-emerald">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-tool-emerald">
                Intensity Level
              </h2>
              <span className="text-3xl font-bold text-tool-emerald text-glow-emerald">
                {intensity[0]}%
              </span>
            </div>

            <div className="px-2">
              <Slider
                value={intensity}
                onValueChange={setIntensity}
                min={50}
                max={100}
                step={1}
                className="[&>span:first-child]:bg-secondary [&>span:first-child>span]:bg-tool-emerald [&>span:last-child]:bg-tool-emerald [&>span:last-child]:border-tool-emerald"
              />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>50%</span>
              <span>70%</span>
              <span>80%</span>
              <span>90%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="mb-6">
            <div className={`inline-block px-4 py-2 rounded-full bg-tool-emerald/10 border border-tool-emerald/30 mb-4`}>
              <span className={`font-semibold ${zoneColor}`}>
                {recommendation.zone}
              </span>
            </div>
            <p className="text-muted-foreground">
              {recommendation.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-secondary/50 rounded-lg p-6 text-center border border-tool-emerald/20">
              <p className="text-muted-foreground text-sm mb-2">
                Recommended Sets
              </p>
              <p className="text-4xl font-bold text-tool-emerald">
                {recommendation.sets}
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-6 text-center border border-tool-emerald/20">
              <p className="text-muted-foreground text-sm mb-2">
                Reps per Set
              </p>
              <p className="text-4xl font-bold text-tool-emerald">
                {recommendation.reps}
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-6 text-center border border-tool-emerald/20">
              <p className="text-muted-foreground text-sm mb-2">
                Total Volume Range
              </p>
              <p className="text-4xl font-bold text-tool-emerald">
                {recommendation.totalVolume}
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-tool-emerald/10">
            <h3 className="text-sm font-medium text-tool-emerald mb-3">Quick Reference</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-tool-blue font-medium">&lt;70%</p>
                <p className="text-muted-foreground">3-6 sets × 6-12 reps</p>
              </div>
              <div className="space-y-1">
                <p className="text-tool-emerald font-medium">70-80%</p>
                <p className="text-muted-foreground">3-5 sets × 4-6 reps</p>
              </div>
              <div className="space-y-1">
                <p className="text-tool-yellow font-medium">80-90%</p>
                <p className="text-muted-foreground">4-8 sets × 2-4 reps</p>
              </div>
              <div className="space-y-1">
                <p className="text-tool-red font-medium">≥90%</p>
                <p className="text-muted-foreground">5-10 sets × 1-2 reps</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrelepinTool;
