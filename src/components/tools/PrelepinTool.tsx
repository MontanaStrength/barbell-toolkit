import { useState } from "react";
import BackButton from "@/components/ui/back-button";
import { Slider } from "@/components/ui/slider";

interface PrelepinToolProps {
  onBack: () => void;
}

const PrelepinTool = ({ onBack }: PrelepinToolProps) => {
  const [intensity, setIntensity] = useState([75]);

  const minIntensity = 50;
  const maxIntensity = 100;
  const intensityTicks = [50, 60, 70, 80, 90, 100] as const;
  const zoneBoundaries = [70, 80, 90] as const;
  
  // Zone segments for color-coded track (percentages of slider width)
  const zoneSegments = [
    { start: 0, end: 40, color: "bg-tool-blue/30" },      // 50-70% = 0-40% of track
    { start: 40, end: 60, color: "bg-tool-emerald/30" },  // 70-80% = 40-60% of track
    { start: 60, end: 80, color: "bg-tool-yellow/30" },   // 80-90% = 60-80% of track
    { start: 80, end: 100, color: "bg-tool-red/30" },     // 90-100% = 80-100% of track
  ];

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
        <BackButton onClick={onBack} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Better Prilepin's Table
          </h1>
          <p className="text-muted-foreground">
            Dynamic recommendations based on training intensity
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-tool-emerald">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-foreground">
                Intensity Level
              </h2>
              <span className="text-3xl font-semibold text-tool-emerald">
                {intensity[0]}%
              </span>
            </div>

            <div className="px-2 relative">
              {/* Color-coded zone segments */}
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <div className="relative w-full h-2 rounded-full overflow-hidden">
                  {zoneSegments.map((segment, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 h-full ${segment.color}`}
                      style={{
                        left: `${segment.start}%`,
                        width: `${segment.end - segment.start}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Zone boundary tick marks */}
              {zoneBoundaries.map((boundary) => (
                <div
                  key={boundary}
                  className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-muted-foreground/50 pointer-events-none z-10"
                  style={{ left: `${((boundary - minIntensity) / (maxIntensity - minIntensity)) * 100}%` }}
                />
              ))}
              
              <Slider
                value={intensity}
                onValueChange={setIntensity}
                min={minIntensity}
                max={maxIntensity}
                step={1}
                className="relative z-0 [&>span:first-child]:bg-transparent [&>span:first-child>span]:bg-foreground/80 [&_[role=slider]]:bg-foreground [&_[role=slider]]:border-foreground"
              />
            </div>

            <div className="relative mt-3 h-4 text-xs text-muted-foreground">
              {intensityTicks.map((t) => (
                <span
                  key={t}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${((t - minIntensity) / (maxIntensity - minIntensity)) * 100}%` }}
                >
                  {t}%
                </span>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className={`inline-block px-4 py-2 rounded-full bg-secondary border border-border mb-3`}>
              <span className={`font-medium ${zoneColor}`}>
                {recommendation.zone}
              </span>
            </div>
            <p className="text-muted-foreground">
              {recommendation.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
              <p className="text-muted-foreground text-sm mb-2">
                Recommended Sets
              </p>
              <p className="text-3xl font-semibold text-foreground">
                {recommendation.sets}
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
              <p className="text-muted-foreground text-sm mb-2">
                Reps per Set
              </p>
              <p className="text-3xl font-semibold text-foreground">
                {recommendation.reps}
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
              <p className="text-muted-foreground text-sm mb-2">
                Total Volume Range
              </p>
              <p className="text-3xl font-semibold text-foreground">
                {recommendation.totalVolume}
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Reference</h3>
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
