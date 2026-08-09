import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Nexus interface crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const detail = this.state.error?.message || String(this.state.error || 'Неизвестная ошибка');

    return (
      <main className="min-h-[100dvh] bg-[#08090b] text-zinc-100 flex items-center justify-center p-5">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111216] p-5 shadow-2xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/10 text-sm font-bold text-teal-300">
            N
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300/80">Nexus recovery</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Интерфейс не смог загрузиться</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Перезагрузите приложение. Если ошибка повторится, текст ниже поможет быстро найти её причину.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-10 rounded-xl bg-teal-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-200"
            >
              Перезагрузить
            </button>
            <a
              href="/"
              className="min-h-10 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium flex items-center hover:bg-white/5"
            >
              На главную
            </a>
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-4 max-h-36 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-amber-200/90 whitespace-pre-wrap break-words">
              {detail}
            </pre>
          ) : null}
        </section>
      </main>
    );
  }
}
