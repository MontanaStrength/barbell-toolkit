import { useState } from "react";
import { Weight, Plus, Trash2, BarChart3 } from "lucide-react";
import BackButton from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface TonnageToolProps {
  onBack: () => void;
}

interface Exercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

const TonnageTool = ({ onBack }: TonnageToolProps) => {
  const [useKg, setUseKg] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: crypto.randomUUID(), name: "", sets: "", reps: "", weight: "" },
  ]);

  const unitLabel = useKg ? "kg" : "lbs";

  const addExercise = () => {
    setExercises([
      ...exercises,
      { id: crypto.randomUUID(), name: "", sets: "", reps: "", weight: "" },
    ]);
  };

  const removeExercise = (id: string) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter((e) => e.id !== id));
    }
  };

  const updateExercise = (id: string, field: keyof Exercise, value: string) => {
    setExercises(
      exercises.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  // Default placeholder values
  const defaultSets = 4;
  const defaultReps = 8;
  const defaultWeight = useKg ? 100 : 225;

  const calculateExerciseTonnage = (exercise: Exercise): number => {
    const sets = exercise.sets ? parseFloat(exercise.sets) : defaultSets;
    const reps = exercise.reps ? parseFloat(exercise.reps) : defaultReps;
    const weight = exercise.weight ? parseFloat(exercise.weight) : defaultWeight;
    return sets * reps * weight;
  };

  const totalTonnage = exercises.reduce(
    (sum, ex) => sum + calculateExerciseTonnage(ex),
    0
  );

  const totalReps = exercises.reduce((sum, ex) => {
    const sets = ex.sets ? parseFloat(ex.sets) : defaultSets;
    const reps = ex.reps ? parseFloat(ex.reps) : defaultReps;
    return sum + sets * reps;
  }, 0);

  const totalSets = exercises.reduce((sum, ex) => {
    return sum + (ex.sets ? parseFloat(ex.sets) : defaultSets);
  }, 0);

  const averageIntensity = totalReps > 0 ? totalTonnage / totalReps : 0;

  // Convert for display if using lbs (internally calculate in entered units)
  const displayTonnage = totalTonnage;
  const displayAvgIntensity = averageIntensity;

  const formatTonnage = (value: number): string => {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <BackButton onClick={onBack} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Weight className="w-5 h-5 text-tool-pink" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tonnage Calculator</h1>
        </div>
        <p className="text-muted-foreground">
          Track total volume load across exercises. Tonnage = Sets × Reps × Weight.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center justify-between">
            Exercises
            <div className="flex items-center gap-2 text-sm font-normal">
              <span className={!useKg ? "text-foreground" : "text-muted-foreground"}>lbs</span>
              <Switch checked={useKg} onCheckedChange={setUseKg} />
              <span className={useKg ? "text-foreground" : "text-muted-foreground"}>kg</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {exercises.map((exercise, index) => (
            <div
              key={exercise.id}
              className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3"
            >
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  Exercise {index + 1}
                </Label>
                {exercises.length > 1 && (
                  <button
                    onClick={() => removeExercise(exercise.id)}
                    className="text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <Input
                placeholder="Exercise name (optional)"
                value={exercise.name}
                onChange={(e) => updateExercise(exercise.id, "name", e.target.value)}
              />
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Sets</Label>
                  <Input
                    type="number"
                    placeholder="4"
                    value={exercise.sets}
                    onChange={(e) => updateExercise(exercise.id, "sets", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Reps</Label>
                  <Input
                    type="number"
                    placeholder="8"
                    value={exercise.reps}
                    onChange={(e) => updateExercise(exercise.id, "reps", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Weight ({unitLabel})</Label>
                  <Input
                    type="number"
                    placeholder={useKg ? "100" : "225"}
                    value={exercise.weight}
                    onChange={(e) => updateExercise(exercise.id, "weight", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              
              {calculateExerciseTonnage(exercise) > 0 && (
                <div className="text-right text-sm">
                  <span className="text-muted-foreground">Subtotal: </span>
                  <span className="font-medium text-foreground">
                    {calculateExerciseTonnage(exercise).toLocaleString()} {unitLabel}
                  </span>
                </div>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addExercise}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Exercise
          </Button>
        </CardContent>
      </Card>

      {totalTonnage > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-tool-pink" />
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground mb-1">Total Sets</p>
                <p className="text-2xl font-bold text-foreground">{totalSets}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground mb-1">Total Reps</p>
                <p className="text-2xl font-bold text-foreground">{totalReps}</p>
              </div>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-tool-pink/10 border border-tool-pink/20">
              <p className="text-sm text-muted-foreground mb-1">Total Tonnage</p>
              <p className="text-4xl font-bold text-tool-pink mb-1">
                {formatTonnage(displayTonnage)} {unitLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                total volume
              </p>
            </div>
            
            <div className="mt-4 text-center p-4 rounded-lg bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">Average Load per Rep</p>
              <p className="text-xl font-semibold text-foreground">
                {displayAvgIntensity.toFixed(1)} {unitLabel}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default TonnageTool;
