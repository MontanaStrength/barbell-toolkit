import { useRef, useState } from 'react';
import { Upload, Video, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadStateProps {
  onVideoSelected: (file: File) => void;
}

export function UploadState({ onVideoSelected }: UploadStateProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      onVideoSelected(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onVideoSelected(files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-lg font-medium text-foreground mb-2">Upload Video</h2>
        <p className="text-muted-foreground text-sm">
          Record or upload a video of your lift for analysis
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 md:p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-tool-red bg-tool-red/5'
            : 'border-border hover:border-tool-red/50 hover:bg-secondary/30'
          }
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-foreground font-medium mb-2">
          Drag & Drop Video
        </p>
        <p className="text-muted-foreground text-sm">
          or click to browse
        </p>
        <p className="text-muted-foreground/60 text-xs mt-2">
          MP4, MOV, WebM supported
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-muted-foreground text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12 border-border hover:border-tool-red/50 hover:bg-secondary/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <Video className="w-4 h-4 mr-2" />
          Choose File
        </Button>
        
        <Button
          variant="outline"
          className="flex-1 h-12 border-border hover:border-tool-red/50 hover:bg-secondary/50"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="w-4 h-4 mr-2" />
          Record
          <input
            ref={cameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </Button>
      </div>
    </div>
  );
}
