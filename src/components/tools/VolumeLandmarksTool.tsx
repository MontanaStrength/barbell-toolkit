import { useState } from "react";
import { Layers, Info, ChevronDown, ChevronUp } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VolumeLandmarksToolProps {
  onBack: () => void;
}

interface MuscleGroup {
  name: string;
  mev: string;
  mav: string;
  mrv: string;
  frequency: string;
  notes: string;
}

const muscleGroups: MuscleGroup[] = [
  {
    name: "Quads",
    mev: "6-8",
    mav: "12-18",
    mrv: "18-25",
    frequency: "2-3x",
    notes: "High recovery demand. Compounds count heavily. Beginners on lower end.",
  },
  {
    name: "Hamstrings",
    mev: "4-6",
    mav: "10-16",
    mrv: "16-20",
    frequency: "2x",
    notes: "RDLs/stiff-legs are high-fatigue. Curls are lower fatigue per set.",
  },
  {
    name: "Glutes",
    mev: "0-2",
    mav: "4-12",
    mrv: "12-20",
    frequency: "2-3x",
    notes: "Often get enough from squats/deads. Direct work for emphasis.",
  },
  {
    name: "Chest",
    mev: "6-8",
    mav: "12-20",
    mrv: "20-26",
    frequency: "2-3x",
    notes: "Responds well to higher frequency. Flyes are lower fatigue.",
  },
  {
    name: "Back (Width)",
    mev: "6-8",
    mav: "12-20",
    mrv: "20-28",
    frequency: "2-3x",
    notes: "Pulldowns, pull-ups, rows with elbow flare. High volume tolerance.",
  },
  {
    name: "Back (Thickness)",
    mev: "6-8",
    mav: "10-16",
    mrv: "16-22",
    frequency: "2x",
    notes: "Rows, deadlift variations. Higher fatigue than width work.",
  },
  {
    name: "Front Delts",
    mev: "0",
    mav: "0-6",
    mrv: "6-12",
    frequency: "1-2x",
    notes: "Usually get enough from pressing. Direct work rarely needed.",
  },
  {
    name: "Side Delts",
    mev: "6-8",
    mav: "16-22",
    mrv: "22-30",
    frequency: "3-6x",
    notes: "Very high volume tolerance. Low fatigue. Can train frequently.",
  },
  {
    name: "Rear Delts",
    mev: "4-6",
    mav: "12-18",
    mrv: "18-26",
    frequency: "2-4x",
    notes: "Often undertrained. Face pulls, reverse flyes. Low fatigue.",
  },
  {
    name: "Biceps",
    mev: "4-6",
    mav: "10-18",
    mrv: "18-26",
    frequency: "2-4x",
    notes: "Get work from rows. Direct work for size. Curls are low fatigue.",
  },
  {
    name: "Triceps",
    mev: "4-6",
    mav: "10-16",
    mrv: "16-22",
    frequency: "2-3x",
    notes: "Heavy pressing hits long head. Extensions for lateral/medial.",
  },
  {
    name: "Traps",
    mev: "0-2",
    mav: "6-14",
    mrv: "14-22",
    frequency: "2-3x",
    notes: "Deadlifts/rows hit traps. Direct work if lagging.",
  },
  {
    name: "Forearms",
    mev: "0-2",
    mav: "4-10",
    mrv: "10-18",
    frequency: "2-4x",
    notes: "Grip work from pulling. Direct work for size/grip strength.",
  },
  {
    name: "Abs",
    mev: "0",
    mav: "6-16",
    mrv: "16-25",
    frequency: "3-5x",
    notes: "Compounds provide stimulus. Direct work for visibility/strength.",
  },
  {
    name: "Calves",
    mev: "6-8",
    mav: "12-18",
    mrv: "18-26",
    frequency: "3-5x",
    notes: "Stubborn muscle. High frequency, full ROM, controlled eccentrics.",
  },
];

const VolumeLandmarksTool = ({ onBack }: VolumeLandmarksToolProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <main className="container mx-auto px-4 py-10 max-w-4xl">
      <BackButton onClick={onBack} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Layers className="w-5 h-5 text-tool-teal" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Volume Landmarks</h1>
        </div>
        <p className="text-muted-foreground">
          Weekly set guidelines per muscle group for hypertrophy programming.
        </p>
      </div>

      <Collapsible open={showInfo} onOpenChange={setShowInfo} className="mb-6">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-4 h-4" />
          {showInfo ? "Hide" : "Show"} landmark definitions
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardContent className="pt-6 grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-tool-emerald/10 border border-tool-emerald/20">
                <h4 className="font-semibold text-tool-emerald mb-2">MEV</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>Minimum Effective Volume</strong> — The lowest volume that produces measurable gains. Good for maintenance or when prioritizing other muscles.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-tool-blue/10 border border-tool-blue/20">
                <h4 className="font-semibold text-tool-blue mb-2">MAV</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>Maximum Adaptive Volume</strong> — The "sweet spot" range where most gains occur. Target this for muscles you want to grow.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-tool-red/10 border border-tool-red/20">
                <h4 className="font-semibold text-tool-red mb-2">MRV</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>Maximum Recoverable Volume</strong> — The upper limit before recovery suffers. Only approach this in overreaching phases.
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Weekly Sets per Muscle Group</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px]">Muscle</TableHead>
                  <TableHead className="text-center text-tool-emerald">MEV</TableHead>
                  <TableHead className="text-center text-tool-blue">MAV</TableHead>
                  <TableHead className="text-center text-tool-red">MRV</TableHead>
                  <TableHead className="text-center">Freq</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {muscleGroups.map((muscle) => (
                  <Collapsible
                    key={muscle.name}
                    open={expandedRow === muscle.name}
                    onOpenChange={(open) => setExpandedRow(open ? muscle.name : null)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer">
                          <TableCell className="font-medium">{muscle.name}</TableCell>
                          <TableCell className="text-center text-tool-emerald font-mono">
                            {muscle.mev}
                          </TableCell>
                          <TableCell className="text-center text-tool-blue font-mono font-semibold">
                            {muscle.mav}
                          </TableCell>
                          <TableCell className="text-center text-tool-red font-mono">
                            {muscle.mrv}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {muscle.frequency}
                          </TableCell>
                          <TableCell>
                            {expandedRow === muscle.name ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                          <TableCell colSpan={6} className="py-3">
                            <p className="text-sm text-muted-foreground pl-2">
                              {muscle.notes}
                            </p>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 rounded-lg bg-secondary/30 border border-border">
        <h4 className="font-medium text-foreground mb-2">How to Use</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Start at MEV</strong> early in a mesocycle, progress toward MAV.</li>
          <li>• <strong>Target MAV</strong> for muscles you want to prioritize.</li>
          <li>• <strong>Approach MRV</strong> only in planned overreaching blocks.</li>
          <li>• <strong>Individual variation</strong> is significant—use these as starting points.</li>
          <li>• <strong>Count hard sets</strong> (within 0-4 RIR) that target the muscle.</li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Based on research and practical recommendations. Individual needs vary.
      </p>
    </main>
  );
};

export default VolumeLandmarksTool;
