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
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-tool-blue via-tool-purple to-tool-red flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
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
              variant="outline"
              size="sm"
              className="border-tool-red/30 text-tool-red hover:bg-tool-red/10 hover:border-tool-red"
            >
              <Heart className="w-4 h-4 mr-2" />
              Support
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-tool-blue via-tool-purple to-tool-red bg-clip-text text-transparent">
                Support the Developer
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                If you find these tools useful, consider buying me a coffee!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <p className="text-foreground mb-4">
                  This toolkit is built with ❤️ for the strength training community. 
                  Your support helps keep the project alive and enables new features.
                </p>
                <div className="flex flex-col gap-3">
                  <Button className="w-full bg-tool-yellow text-primary-foreground hover:bg-tool-yellow/90">
                    ☕ Buy Me a Coffee - $5
                  </Button>
                  <Button variant="outline" className="w-full border-tool-purple/30 text-tool-purple hover:bg-tool-purple/10">
                    🏋️ Sponsor Monthly - $10/mo
                  </Button>
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
