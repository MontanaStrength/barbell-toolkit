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
              Prototype
            </span>
          </div>
          <p className="text-muted-foreground">
            Upload a video to analyze bar path and velocity metrics
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-tool-red">
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
                  ? "border-tool-red bg-tool-red/5"
                  : "border-border hover:border-tool-red/50 hover:bg-secondary/30"
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
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
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
              <div className="w-12 h-12 mx-auto mb-6 rounded-full border-2 border-border border-t-tool-red animate-spin" />
              <p className="text-lg font-medium text-foreground mb-4">
                Analyzing Bar Path...
              </p>
              <div className="max-w-md mx-auto">
                <Progress value={Math.min(progress, 100)} className="h-1.5 bg-secondary [&>div]:bg-tool-red" />
              </div>
              <p className="text-muted-foreground text-sm mt-3">
                {Math.min(Math.round(progress), 100)}%
              </p>
            </div>
          )}

          {showResults && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-foreground">
                Analysis Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <Gauge className="w-8 h-8 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Average Velocity
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {dummyData.avgVelocity}
                  </p>
                  <p className="text-muted-foreground text-xs">m/s</p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <Zap className="w-8 h-8 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Peak Force
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {dummyData.peakForce}
                  </p>
                  <p className="text-muted-foreground text-xs">N</p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-5 text-center border border-border">
                  <Ruler className="w-8 h-8 mx-auto mb-3 text-tool-red" />
                  <p className="text-muted-foreground text-sm mb-1">
                    Range of Motion
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
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
                className="w-full border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
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
