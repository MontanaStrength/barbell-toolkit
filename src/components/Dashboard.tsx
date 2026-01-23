import { Dumbbell, Gauge, Brain, Flame, Table2, Sparkles } from "lucide-react";

interface DashboardProps {
  onSelectTool: (tool: string) => void;
}

const tools = [
  {
    id: "rpe",
    name: "RPE Tools",
    description: "Calculate e1RM, plan loads, and reference RPE percentages",
    icon: Gauge,
    accent: "blue",
    borderColor: "border-tool-blue/30",
    hoverBorder: "hover:border-tool-blue",
    textColor: "text-tool-blue",
    glowClass: "hover:glow-blue",
    bgGradient: "bg-gradient-to-br from-tool-blue/5 to-transparent",
  },
  {
    id: "bar-speed",
    name: "Bar Speed Analyzer",
    description: "Analyze bar path velocity and force from video",
    icon: Dumbbell,
    accent: "red",
    borderColor: "border-tool-red/30",
    hoverBorder: "hover:border-tool-red",
    textColor: "text-tool-red",
    glowClass: "hover:glow-red",
    bgGradient: "bg-gradient-to-br from-tool-red/5 to-transparent",
    badge: "Prototype",
  },
  {
    id: "hanley",
    name: "Hanley Fatigue Metric",
    description: "Calculate normalized stress scores based on volume and intensity",
    icon: Brain,
    accent: "purple",
    borderColor: "border-tool-purple/30",
    hoverBorder: "hover:border-tool-purple",
    textColor: "text-tool-purple",
    glowClass: "hover:glow-purple",
    bgGradient: "bg-gradient-to-br from-tool-purple/5 to-transparent",
  },
  {
    id: "frederick",
    name: "Frederick Metabolic Stress",
    description: "Quantify metabolic stress using volume, intensity, and RIR",
    icon: Flame,
    accent: "yellow",
    borderColor: "border-tool-yellow/30",
    hoverBorder: "hover:border-tool-yellow",
    textColor: "text-tool-yellow",
    glowClass: "hover:glow-yellow",
    bgGradient: "bg-gradient-to-br from-tool-yellow/5 to-transparent",
  },
  {
    id: "prelepin",
    name: "Better Prilepin's Table",
    description: "Dynamic recommendations for sets, reps, and volume",
    icon: Table2,
    accent: "emerald",
    borderColor: "border-tool-emerald/30",
    hoverBorder: "hover:border-tool-emerald",
    textColor: "text-tool-emerald",
    glowClass: "hover:glow-emerald",
    bgGradient: "bg-gradient-to-br from-tool-emerald/5 to-transparent",
  },
  {
    id: "coming-soon",
    name: "Coming Soon",
    description: "A new tool is in development. Stay tuned!",
    icon: Sparkles,
    accent: "muted",
    borderColor: "border-muted-foreground/20",
    hoverBorder: "hover:border-muted-foreground/40",
    textColor: "text-muted-foreground",
    glowClass: "",
    bgGradient: "bg-gradient-to-br from-muted/5 to-transparent",
    badge: "Coming Soon",
    disabled: true,
  },
];

const Dashboard = ({ onSelectTool }: DashboardProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isDisabled = 'disabled' in tool && tool.disabled;
        return (
          <button
            key={tool.id}
            onClick={() => !isDisabled && onSelectTool(tool.id)}
            disabled={isDisabled}
            className={`
              group relative p-6 rounded-xl border-2 text-left
              bg-card transition-all duration-300
              ${tool.borderColor} ${tool.hoverBorder} ${tool.glowClass}
              ${tool.bgGradient}
              ${isDisabled 
                ? 'cursor-not-allowed opacity-60' 
                : 'hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            {tool.badge && (
              <span className={`absolute top-4 right-4 px-2 py-0.5 text-xs rounded-full bg-tool-red/10 ${tool.textColor} border border-current`}>
                {tool.badge}
              </span>
            )}
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-secondary group-hover:bg-${tool.accent}/10 transition-colors`}>
              <Icon className={`w-6 h-6 ${tool.textColor}`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${tool.textColor} group-hover:text-glow-${tool.accent}`}>
              {tool.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tool.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default Dashboard;
