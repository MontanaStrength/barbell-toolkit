import { useState, useRef } from "react";
import { ArrowLeft, Upload, Gauge, Zap, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface BarSpeedToolProps {
  onBack: () => void;
}

const BarSpeedTool = ({ onBack }: BarSpeedToolProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    simulateAnalysis();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      simulateAnalysis();
    }
  };

  const simulateAnalysis = () => {
    setIsAnalyzing(true);
    setProgress(0);
    setShowResults(false);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          setShowResults(true);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
  };

  const dummyData = {
    avgVelocity: 0.72,
    peakForce: 1847,
    rangeOfMotion: 0.89,
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-tool-red hover:text-tool-red hover:bg-tool-red/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-tool-red text-glow-red mb-2">
            Bar Speed Analyzer
          </h1>
          <p className="text-muted-foreground">
            Upload a video to analyze bar path and velocity metrics
          </p>
          <span className="inline-block mt-2 px-3 py-1 bg-tool-red/10 text-tool-red text-xs rounded-full border border-tool-red/30">
            UI Prototype
          </span>
        </div>

        <div className="bg-card border border-tool-red/20 rounded-lg p-6 glow-red">
          {!isAnalyzing && !showResults && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleFileSelect}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-all duration-200
                ${isDragging
                  ? "border-tool-red bg-tool-red/10"
                  : "border-tool-red/30 hover:border-tool-red/60 hover:bg-tool-red/5"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-16 h-16 mx-auto mb-4 text-tool-red" />
              <p className="text-lg font-medium text-foreground mb-2">
                Drag & Drop Your Video Here
              </p>
              <p className="text-muted-foreground text-sm">
                or click to browse files
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-tool-red/30 border-t-tool-red animate-spin" />
              <p className="text-lg font-medium text-tool-red mb-4">
                Analyzing Bar Path...
              </p>
              <div className="max-w-md mx-auto">
                <Progress value={Math.min(progress, 100)} className="h-2 bg-secondary [&>div]:bg-tool-red" />
              </div>
              <p className="text-muted-foreground text-sm mt-2">
                {Math.min(Math.round(progress), 100)}%
              </p>
            </div>
          )}

          {showResults && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-tool-red mb-6">
                Analysis Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-secondary/50 rounded-lg p-6 text-center border border-tool-red/20">
                  <Gauge className="w-10 h-10 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Average Velocity
                  </p>
                  <p className="text-3xl font-bold text-tool-red">
                    {dummyData.avgVelocity}
                  </p>
                  <p className="text-muted-foreground text-xs">m/s</p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-6 text-center border border-tool-red/20">
                  <Zap className="w-10 h-10 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Peak Force
                  </p>
                  <p className="text-3xl font-bold text-tool-red">
                    {dummyData.peakForce}
                  </p>
                  <p className="text-muted-foreground text-xs">N</p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-6 text-center border border-tool-red/20">
                  <Ruler className="w-10 h-10 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Range of Motion
                  </p>
                  <p className="text-3xl font-bold text-tool-red">
                    {dummyData.rangeOfMotion}
                  </p>
                  <p className="text-muted-foreground text-xs">m</p>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setShowResults(false);
                  setProgress(0);
                }}
                className="w-full mt-4 border-tool-red/30 text-tool-red hover:bg-tool-red/10"
              >
                Analyze Another Video
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarSpeedTool;
