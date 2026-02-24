import { cn } from "@/lib/utils";

interface BracketCardProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function BracketCard({ children, className, label }: BracketCardProps) {
  return (
    <div className={cn("bracket-card relative p-5", className)}>
      {label && (
        <span className="absolute -top-px left-3 text-[9px] font-mono tracking-[0.2em] text-accent uppercase px-1 bg-background">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
