import React from "react";

interface MainCanvasProps {
  children: React.ReactNode;
}

/**
 * MainCanvas — simple scrollable container that fills all the space
 * below the TabBar. The tab strip has moved to TabBar.tsx.
 */
export const MainCanvas: React.FC<MainCanvasProps> = ({ children }) => {
  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0 relative bg-control-bg">
      {children}
    </div>
  );
};
