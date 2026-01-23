import { Dumbbell, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Header = () => {
  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-tool-blue" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              Barbell Training Toolkit
            </h1>
            <p className="text-xs text-muted-foreground">
              Mathematical tools for serious lifters
            </p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="default"
              className="text-muted-foreground hover:text-tool-red hover:bg-tool-red/10 px-4 py-2"
            >
              <Heart className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Support</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-foreground">
                Support the Developer
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                If you find these tools useful, consider buying me a coffee!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-foreground text-sm mb-4 leading-relaxed">
                  This toolkit is built with care for the strength training community. 
                  Your support helps keep the project alive and enables new features.
                </p>
                <div className="flex flex-col gap-3">
                  <a 
                    href="https://buymeacoffee.com/montanastrength" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button className="w-full bg-tool-yellow text-primary-foreground hover:bg-tool-yellow/90">
                      ☕ Buy Me a Coffee
                    </Button>
                  </a>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Thank you for your generosity! 🙏
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
};

export default Header;
