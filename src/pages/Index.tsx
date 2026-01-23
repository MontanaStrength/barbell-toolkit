import { useState } from "react";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import RPETool from "@/components/tools/RPETool";
import BarSpeedTool from "@/components/tools/BarSpeedTool";
import HanleyTool from "@/components/tools/HanleyTool";
import FrederickTool from "@/components/tools/FrederickTool";
import PrelepinTool from "@/components/tools/PrelepinTool";

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
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Your Training{" "}
              <span className="bg-gradient-to-r from-tool-blue via-tool-purple to-tool-emerald bg-clip-text text-transparent">
                Command Center
              </span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Five precision tools to optimize your barbell training. Calculate loads, 
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
