import type { User } from "firebase/auth";
import {
  CalendarDays,
  FileDown,
  History,
  LogOut,
  Target,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";

export type AppScreen = "today" | "week" | "goals" | "history" | "export";

type AppShellProps = {
  user: User;
  activeScreen: AppScreen;
  onScreenChange: (screen: AppScreen) => void;
  onSignOut: () => void;
  children: ReactNode;
};

const NAV_ITEMS = [
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "week", label: "Неделя", icon: Trophy },
  { id: "goals", label: "Цели", icon: Target },
  { id: "history", label: "История", icon: History },
  { id: "export", label: "Экспорт", icon: FileDown },
] satisfies Array<{ id: AppScreen; label: string; icon: typeof CalendarDays }>;

export function AppShell({
  user,
  activeScreen,
  onScreenChange,
  onSignOut,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xl font-black tracking-normal">Action Board</p>
              <p className="text-xs font-medium text-slate-500">{user.email}</p>
            </div>
            <button className="btn btn-secondary lg:hidden" type="button" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  className={`btn min-w-fit ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  key={item.id}
                  type="button"
                  onClick={() => onScreenChange(item.id)}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button className="btn btn-secondary hidden lg:inline-flex" type="button" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
