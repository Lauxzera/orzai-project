"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactElement<{ width?: number; height?: number }>;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height))
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const ready = size.width > 0 && size.height > 0;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={containerRef}
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-tooltip-cursor]:fill-muted",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {ready ?React.cloneElement(children, { width: size.width, height: size.height }) : null}
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        [data-chart=${id}] {
          ${colorConfig.map(([key, item]) => `--color-${key}: ${item.color};`).join("\n")}
        }
      `
      }}
    />
  );
}

function ChartTooltip(props: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return (
    <RechartsPrimitive.Tooltip
      isAnimationActive={false}
      offset={10}
      wrapperStyle={{ pointerEvents: "none", outline: "none" }}
      {...props}
    />
  );
}

function ChartTooltipContent({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; name?: string | number; color?: string; value?: string | number }>;
  label?: React.ReactNode;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div className="grid min-w-36 gap-1.5 rounded-md border bg-card/95 p-2 text-xs shadow-xl">
      {label ?<div className="font-medium text-foreground">{String(label)}</div> : null}
      {payload.map((item) => {
        const key = String(item.dataKey || item.name || "");
        const itemConfig = config[key];
        return (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {itemConfig?.label || item.name}
            </div>
            <span className="font-semibold text-foreground">{String(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
