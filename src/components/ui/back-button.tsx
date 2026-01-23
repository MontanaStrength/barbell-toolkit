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
      onClick={onClick}
      className="mb-6 gap-2 border-border/60 bg-secondary/50 hover:bg-secondary hover:border-border"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Button>
  );
};

export default BackButton;
