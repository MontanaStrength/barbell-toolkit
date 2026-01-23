import BackButton from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

interface JessicaBielToolProps {
  onBack: () => void;
}

const JessicaBielTool = ({ onBack }: JessicaBielToolProps) => {
  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <BackButton onClick={onBack} />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Jessica_Biel_2013.jpg/440px-Jessica_Biel_2013.jpg"
              alt="Jessica Biel"
              className="w-full h-auto object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <p className="text-3xl md:text-4xl font-bold text-white text-center">
                Hey Lifter 👋
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-muted-foreground mt-6 text-sm flex items-center justify-center gap-2">
        <Heart className="w-4 h-4 text-tool-red" />
        You found the Easter egg. Now go lift something heavy.
      </p>
    </main>
  );
};

export default JessicaBielTool;
