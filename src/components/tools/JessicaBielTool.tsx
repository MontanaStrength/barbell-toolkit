import BackButton from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import sydSpaceImage from "@/assets/syd-space.png";

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
            src={sydSpaceImage}
            alt="Syd floating in space"
            className="w-full h-auto object-cover"
          />
        </CardContent>
      </Card>
    </main>
  );
};

export default JessicaBielTool;
