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
    borderColor: "border-tool-blue/20",
    hoverBorder: "hover:border-tool-blue/50",
    textColor: "text-tool-blue",
    shadowClass: "hover:shadow-tool-blue",
  },
  {
    id: "bar-speed",
    name: "Bar Speed Analyzer",
    description: "Analyze bar path velocity and force from video",
    icon: Dumbbell,
    accent: "red",
    borderColor: "border-tool-red/20",
    hoverBorder: "hover:border-tool-red/50",
    textColor: "text-tool-red",
    shadowClass: "hover:shadow-tool-red",
    badge: "Prototype",
  },
  {
    id: "hanley",
    name: "Hanley Fatigue Metric",
    description: "Calculate normalized stress scores based on volume and intensity",
    icon: Brain,
    accent: "purple",
    borderColor: "border-tool-purple/20",
    hoverBorder: "hover:border-tool-purple/50",
    textColor: "text-tool-purple",
    shadowClass: "hover:shadow-tool-purple",
  },
  {
    id: "frederick",
    name: "Frederick Metabolic Stress",
    description: "Quantify metabolic stress using volume, intensity, and RIR",
    icon: Flame,
    accent: "yellow",
    borderColor: "border-tool-yellow/20",
    hoverBorder: "hover:border-tool-yellow/50",
    textColor: "text-tool-yellow",
    shadowClass: "hover:shadow-tool-yellow",
  },
  {
    id: "prelepin",
    name: "Better Prilepin's Table",
    description: "Dynamic recommendations for sets, reps, and volume",
    icon: Table2,
    accent: "emerald",
    borderColor: "border-tool-emerald/20",
    hoverBorder: "hover:border-tool-emerald/50",
    textColor: "text-tool-emerald",
    shadowClass: "hover:shadow-tool-emerald",
  },
  {
    id: "coming-soon",
    name: "Coming Soon",
    description: "A new tool is in development. Stay tuned!",
    icon: Sparkles,
    accent: "muted",
    borderColor: "border-muted-foreground/10",
    hoverBorder: "hover:border-muted-foreground/20",
    textColor: "text-muted-foreground",
    shadowClass: "",
    badge: "Coming Soon",
    disabled: true,
  },
];

const Dashboard = ({ onSelectTool }: DashboardProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isDisabled = 'disabled' in tool && tool.disabled;
        return (
          <button
            key={tool.id}
            onClick={() => !isDisabled && onSelectTool(tool.id)}
            disabled={isDisabled}
            className={`
              group relative p-6 rounded-xl border text-left
              bg-card hover-lift transition-all duration-300
              ${tool.borderColor} ${tool.hoverBorder} ${tool.shadowClass}
              ${isDisabled 
                ? 'cursor-not-allowed opacity-50' 
                : ''
              }
            `}
          >
            {tool.badge && (
              <span className={`absolute top-4 right-4 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary ${tool.textColor}`}>
                {tool.badge}
              </span>
            )}
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 bg-secondary/80 group-hover:bg-secondary transition-colors`}>
              <Icon className={`w-5 h-5 ${tool.textColor}`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 text-foreground group-hover:${tool.textColor} transition-colors`}>
              {tool.name}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tool.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default Dashboard;
