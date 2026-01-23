import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

const BackButton = ({ onClick, label = "Back to Dashboard" }: BackButtonProps) => {
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={onClick}
      className="mb-6 gap-3 border-2 border-primary/50 bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary font-semibold shadow-md"
    >
      <ArrowLeft className="w-5 h-5" />
      {label}
    </Button>
  );
};

export default BackButton;
