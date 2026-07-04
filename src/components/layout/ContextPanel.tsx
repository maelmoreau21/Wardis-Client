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
            <div className="h-9 px-3 flex items-center justify-between border-b border-control-border bg-control-panel-light/30 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-control-text-bright">
                {title}
              </span>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1 rounded hover:bg-control-panel-light text-control-text hover:text-control-text-bright cursor-pointer"
                title="Collapse Panel"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
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
          className="w-1.5 hover:w-2 bg-transparent hover:bg-control-cyan/40 cursor-col-resize transition-all duration-150 z-20"
        />
      ) : (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-control-panel border-y border-r border-control-border hover:bg-control-panel-light text-control-text hover:text-control-text-bright py-3 px-0.5 rounded-r cursor-pointer z-30 shadow-md"
          title="Expand Panel"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
