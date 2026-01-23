import BackButton from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";

interface JessicaBielToolProps {
  onBack: () => void;
}

const JessicaBielTool = ({ onBack }: JessicaBielToolProps) => {
  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <BackButton onClick={onBack} />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Jessica_Biel_2013.jpg/440px-Jessica_Biel_2013.jpg"
            alt="Jessica Biel"
            className="w-full h-auto object-cover"
          />
        </CardContent>
      </Card>
    </main>
  );
};

export default JessicaBielTool;
