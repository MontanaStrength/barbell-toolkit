import BarbellVelocityTracker from "@/components/barbell-tracker/BarbellVelocityTracker";

interface BarSpeedToolProps {
  onBack: () => void;
}

const BarSpeedTool = ({ onBack }: BarSpeedToolProps) => {
  return <BarbellVelocityTracker onBack={onBack} />;
};

export default BarSpeedTool;
