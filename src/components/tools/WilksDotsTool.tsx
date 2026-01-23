import { useState } from "react";
import { Scale, Trophy, Info } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface WilksDotsToolProps {
  onBack: () => void;
}

// Wilks coefficients (2020 revision)
const calculateWilks = (total: number, bodyweight: number, isMale: boolean): number => {
  const bw = bodyweight;
  
  // Wilks 2020 coefficients
  const maleCoeffs = {
    a: 47.46178854,
    b: 8.472061379,
    c: 0.07369410346,
    d: -0.001395833811,
    e: 7.07665973070743e-6,
    f: -1.20804336482315e-8,
  };
  
  const femaleCoeffs = {
    a: -125.4255398,
    b: 13.71219419,
    c: -0.03307250631,
    d: -0.001050400051,
    e: 9.38773881462799e-6,
    f: -2.3334613884954e-8,
  };
  
  const c = isMale ? maleCoeffs : femaleCoeffs;
  const denominator = c.a + c.b * bw + c.c * Math.pow(bw, 2) + c.d * Math.pow(bw, 3) + c.e * Math.pow(bw, 4) + c.f * Math.pow(bw, 5);
  
  return (total * 500) / denominator;
};

// DOTS coefficients
const calculateDots = (total: number, bodyweight: number, isMale: boolean): number => {
  const bw = bodyweight;
  
  const maleCoeffs = {
    a: -307.75076,
    b: 24.0900756,
    c: -0.1918759221,
    d: 0.0007391293,
    e: -0.000001093,
  };
  
  const femaleCoeffs = {
    a: -57.96288,
    b: 13.6175032,
    c: -0.1126655495,
    d: 0.0005158568,
    e: -0.0000010706,
  };
  
  const c = isMale ? maleCoeffs : femaleCoeffs;
  const denominator = c.a + c.b * bw + c.c * Math.pow(bw, 2) + c.d * Math.pow(bw, 3) + c.e * Math.pow(bw, 4);
  
  return (total * 500) / denominator;
};

const getScoreRating = (score: number, isMale: boolean): { label: string; color: string } => {
  // Approximate benchmarks
  if (isMale) {
    if (score >= 500) return { label: "Elite", color: "text-yellow-500" };
    if (score >= 400) return { label: "Advanced", color: "text-tool-purple" };
    if (score >= 300) return { label: "Intermediate", color: "text-tool-blue" };
    if (score >= 200) return { label: "Novice", color: "text-tool-emerald" };
    return { label: "Beginner", color: "text-muted-foreground" };
  } else {
    if (score >= 400) return { label: "Elite", color: "text-yellow-500" };
    if (score >= 300) return { label: "Advanced", color: "text-tool-purple" };
    if (score >= 225) return { label: "Intermediate", color: "text-tool-blue" };
    if (score >= 150) return { label: "Novice", color: "text-tool-emerald" };
    return { label: "Beginner", color: "text-muted-foreground" };
  }
};

const WilksDotsTool = ({ onBack }: WilksDotsToolProps) => {
  const [bodyweight, setBodyweight] = useState<string>("");
  const [squat, setSquat] = useState<string>("");
  const [bench, setBench] = useState<string>("");
  const [deadlift, setDeadlift] = useState<string>("");
  const [isMale, setIsMale] = useState(true);
  const [useKg, setUseKg] = useState(true);
  const [showFormulas, setShowFormulas] = useState(false);

  // Default placeholder values
  const defaultBw = useKg ? 83 : 183;
  const defaultSquat = useKg ? 200 : 440;
  const defaultBench = useKg ? 140 : 308;
  const defaultDeadlift = useKg ? 230 : 507;

  const bwNum = bodyweight ? parseFloat(bodyweight) : defaultBw;
  const squatNum = squat ? parseFloat(squat) : defaultSquat;
  const benchNum = bench ? parseFloat(bench) : defaultBench;
  const deadliftNum = deadlift ? parseFloat(deadlift) : defaultDeadlift;
  
  // Convert to kg if needed
  const bwKg = useKg ? bwNum : bwNum * 0.453592;
  const totalKg = useKg 
    ? squatNum + benchNum + deadliftNum 
    : (squatNum + benchNum + deadliftNum) * 0.453592;

  const wilksScore = bwKg > 0 && totalKg > 0 ? calculateWilks(totalKg, bwKg, isMale) : 0;
  const dotsScore = bwKg > 0 && totalKg > 0 ? calculateDots(totalKg, bwKg, isMale) : 0;

  const wilksRating = getScoreRating(wilksScore, isMale);
  const dotsRating = getScoreRating(dotsScore, isMale);

  const displayTotal = useKg ? totalKg : totalKg / 0.453592;
  const unitLabel = useKg ? "kg" : "lbs";

  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <BackButton onClick={onBack} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Scale className="w-5 h-5 text-tool-cyan" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Wilks / DOTS Calculator</h1>
        </div>
        <p className="text-muted-foreground">
          Compare strength across weight classes using relative strength coefficients.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center justify-between">
            Lifter Info
            <div className="flex items-center gap-4 text-sm font-normal">
              <div className="flex items-center gap-2">
                <span className={!isMale ? "text-foreground" : "text-muted-foreground"}>Female</span>
                <Switch checked={isMale} onCheckedChange={setIsMale} />
                <span className={isMale ? "text-foreground" : "text-muted-foreground"}>Male</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={!useKg ? "text-foreground" : "text-muted-foreground"}>lbs</span>
                <Switch checked={useKg} onCheckedChange={setUseKg} />
                <span className={useKg ? "text-foreground" : "text-muted-foreground"}>kg</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bodyweight">Bodyweight ({unitLabel})</Label>
            <Input
              id="bodyweight"
              type="number"
              placeholder={useKg ? "e.g., 83" : "e.g., 183"}
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
              className="mt-1.5"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="squat">Squat ({unitLabel})</Label>
              <Input
                id="squat"
                type="number"
                placeholder={useKg ? "200" : "440"}
                value={squat}
                onChange={(e) => setSquat(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="bench">Bench ({unitLabel})</Label>
              <Input
                id="bench"
                type="number"
                placeholder={useKg ? "140" : "308"}
                value={bench}
                onChange={(e) => setBench(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="deadlift">Deadlift ({unitLabel})</Label>
              <Input
                id="deadlift"
                type="number"
                placeholder={useKg ? "230" : "507"}
                value={deadlift}
                onChange={(e) => setDeadlift(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {totalKg > 0 && bwKg > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-tool-cyan" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4 pb-4 border-b border-border">
              <p className="text-sm text-muted-foreground mb-1">Total</p>
              <p className="text-3xl font-bold text-foreground">
                {displayTotal.toFixed(1)} {unitLabel}
              </p>
            </div>
            
            <Tabs defaultValue="wilks" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="wilks">Wilks (2020)</TabsTrigger>
                <TabsTrigger value="dots">DOTS</TabsTrigger>
              </TabsList>
              <TabsContent value="wilks" className="pt-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-tool-cyan mb-2">
                    {wilksScore.toFixed(2)}
                  </p>
                  <p className={`text-lg font-medium ${wilksRating.color}`}>
                    {wilksRating.label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Wilks 2020 coefficient score
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="dots" className="pt-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-tool-cyan mb-2">
                    {dotsScore.toFixed(2)}
                  </p>
                  <p className={`text-lg font-medium ${dotsRating.color}`}>
                    {dotsRating.label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    DOTS coefficient score
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Collapsible open={showFormulas} onOpenChange={setShowFormulas}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-4 h-4" />
          {showFormulas ? "Hide" : "Show"} formula details
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Wilks (2020)</h4>
                <p className="text-muted-foreground">
                  The updated Wilks formula uses a 5th-degree polynomial to normalize 
                  strength across bodyweights. Score = Total × 500 / Coefficient. 
                  Higher scores indicate greater relative strength.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">DOTS</h4>
                <p className="text-muted-foreground">
                  DOTS (Dynamic Objective Team Scoring) uses a 4th-degree polynomial 
                  and is considered by some to be more accurate at extreme bodyweights. 
                  It was developed to address perceived issues with the original Wilks.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Which to use?</h4>
                <p className="text-muted-foreground">
                  Both are widely accepted. IPF uses DOTS for Best Lifter awards. 
                  Wilks 2020 is the updated version of the classic formula. 
                  Use whichever your federation recognizes.
                </p>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </main>
  );
};

export default WilksDotsTool;
