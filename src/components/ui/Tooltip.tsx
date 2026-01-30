'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delayDuration?: number;
  disabled?: boolean;
}

export function Tooltip({ 
  children, 
  content, 
  side = 'bottom', 
  className,
  delayDuration = 200,
  disabled = false 
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showTooltip = React.useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayDuration);
  }, [delayDuration, disabled]);

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  React.useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const padding = 8;

      let x = 0;
      let y = 0;

      switch (side) {
        case 'top':
          x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          y = triggerRect.top - tooltipRect.height - padding;
          break;
        case 'bottom':
          x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          y = triggerRect.bottom + padding;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - padding;
          y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          break;
        case 'right':
          x = triggerRect.right + padding;
          y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          break;
      }

      // Keep tooltip within viewport
      const viewportPadding = 8;
      x = Math.max(viewportPadding, Math.min(x, window.innerWidth - tooltipRect.width - viewportPadding));
      y = Math.max(viewportPadding, Math.min(y, window.innerHeight - tooltipRect.height - viewportPadding));

      setPosition({ x, y });
    }
  }, [isVisible, side]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'fixed z-[100] px-2.5 py-1.5 text-xs font-medium text-popover-foreground bg-popover border border-border rounded-md shadow-md',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            className
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </>
  );
}

// Simple inline tooltip for minimal footprint
export function TooltipSimple({ 
  children, 
  content,
  className 
}: { 
  children: React.ReactNode; 
  content: string;
  className?: string;
}) {
  return (
    <span className={cn('relative group', className)}>
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-1 text-xs font-medium text-popover-foreground bg-popover border border-border rounded shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
        {content}
      </span>
    </span>
  );
}
