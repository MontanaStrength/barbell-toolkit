import { useState } from "react";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import RPETool from "@/components/tools/RPETool";
import BarSpeedTool from "@/components/tools/BarSpeedTool";
import HanleyTool from "@/components/tools/HanleyTool";
import FrederickTool from "@/components/tools/FrederickTool";
import PrelepinTool from "@/components/tools/PrelepinTool";
import OneRepMaxTool from "@/components/tools/OneRepMaxTool";
import WilksDotsTool from "@/components/tools/WilksDotsTool";
import TonnageTool from "@/components/tools/TonnageTool";
import LoadVelocityTool from "@/components/tools/LoadVelocityTool";
import VolumeLandmarksTool from "@/components/tools/VolumeLandmarksTool";
import JessicaBielTool from "@/components/tools/JessicaBielTool";

const Index = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const handleSelectTool = (tool: string) => {
    setActiveTool(tool);
  };

  const handleBack = () => {
    setActiveTool(null);
  };

  const renderTool = () => {
    switch (activeTool) {
      case "rpe":
        return <RPETool onBack={handleBack} />;
      case "bar-speed":
        return <BarSpeedTool onBack={handleBack} />;
      case "hanley":
        return <HanleyTool onBack={handleBack} />;
      case "frederick":
        return <FrederickTool onBack={handleBack} />;
      case "prelepin":
        return <PrelepinTool onBack={handleBack} />;
      case "one-rep-max":
        return <OneRepMaxTool onBack={handleBack} />;
      case "wilks-dots":
        return <WilksDotsTool onBack={handleBack} />;
      case "tonnage":
        return <TonnageTool onBack={handleBack} />;
      case "load-velocity":
        return <LoadVelocityTool onBack={handleBack} />;
      case "volume-landmarks":
        return <VolumeLandmarksTool onBack={handleBack} />;
      case "jessica-biel":
        return <JessicaBielTool onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {activeTool ? (
        renderTool()
      ) : (
        <main className="container mx-auto px-4 py-10">
          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-3 tracking-tight">
              Training Command Center
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Six precision tools to optimize your barbell training. Calculate loads, 
              analyze fatigue, and program smarter.
            </p>
          </div>
          
          <Dashboard onSelectTool={handleSelectTool} />
          
          <footer className="mt-16 text-center text-sm text-muted-foreground">
            <p>Built for lifters who love data as much as lifting.</p>
          </footer>
        </main>
      )}
    </div>
  );
};

export default Index;
