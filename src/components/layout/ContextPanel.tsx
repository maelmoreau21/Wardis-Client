import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ContextPanelProps {
  title?: string;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  title = "Context",
  children,
  defaultWidth = 240,
  minWidth = 180,
  maxWidth = 400
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
  };

  const resize = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX - 64; // Subtract the width of IconRail (~64px)
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setWidth(newWidth);
    }
  };

  const stopResize = () => {
    isResizing.current = false;
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResize);
    };
  }, []);

  return (
    <div className="relative flex h-full shrink-0 select-none">
      <div
        style={{ width: isCollapsed ? 0 : width }}
        className={`h-full bg-control-panel border-r border-control-border flex flex-col overflow-hidden transition-all duration-150 relative ${
          isCollapsed ? "border-r-0" : ""
        }`}
      >
        {/* Panel Header */}
        {!isCollapsed && (
          <>
            <div className="h-10 px-4 flex items-center justify-between border-b border-control-border shrink-0">
              <span className="text-xs font-semibold text-control-text-bright">
                {title}
              </span>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-control-panel-light text-control-text hover:text-control-text-bright cursor-pointer transition-colors"
                title="Réduire le panneau"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {children}
            </div>
          </>
        )}
      </div>

      {/* Resize Handle / Collapse Toggle Indicator */}
      {!isCollapsed ? (
        <div
          onMouseDown={startResize}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-control-cyan/30 cursor-col-resize transition-all duration-150 z-20"
        />
      ) : (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-control-panel border-y border-r border-control-border hover:bg-control-panel-light text-control-text hover:text-control-text-bright py-4 px-1 rounded-r-lg cursor-pointer z-30 shadow-md transition-colors"
          title="Agrandir le panneau"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
