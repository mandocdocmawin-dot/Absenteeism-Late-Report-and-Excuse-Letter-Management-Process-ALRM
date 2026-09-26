import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="size-9 rounded-full text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <Icon className="size-5" strokeWidth={2.1} />
    </Button>
  );
}

export default ThemeToggle;
