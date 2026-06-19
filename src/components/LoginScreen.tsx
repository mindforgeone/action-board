import { LogIn, ShieldCheck } from "lucide-react";

type LoginScreenProps = {
  configured: boolean;
  error: string;
  onSignIn: () => void;
};

export function LoginScreen({ configured, error, onSignIn }: LoginScreenProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Личные данные только после входа
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl">
              Action Board
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Панель действий для оффера 1С-разработчика и формы 65 кг.
            </p>
            <button
              className="btn btn-primary mt-8 min-h-12 px-6 text-base"
              type="button"
              onClick={onSignIn}
              disabled={!configured}
            >
              <LogIn className="h-5 w-5" />
              Войти через Google
            </button>
            {!configured && (
              <p className="mt-4 max-w-xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Firebase еще не подключен. Заполните `.env` по примеру `.env.example` и
                перезапустите проект.
              </p>
            )}
            {error && (
              <p className="mt-4 max-w-xl rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </p>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Главный вопрос дня
              </p>
              <p className="mt-3 text-2xl font-black leading-snug text-slate-950">
                Что я сегодня сделал для оффера и тела?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-0 text-sm font-semibold">
              <div className="border-r border-slate-200 p-5">
                <p className="text-slate-500">Оффер</p>
                <p className="mt-2 text-3xl font-black text-sky-700">1С</p>
              </div>
              <div className="p-5">
                <p className="text-slate-500">Форма</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">65 кг</p>
              </div>
              <div className="col-span-2 border-t border-slate-200 bg-slate-950 p-5 text-white">
                <p className="text-sm text-slate-300">Время, метрики, цели, экспорт отчета.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
