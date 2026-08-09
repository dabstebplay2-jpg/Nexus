import { Component } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Nexus route crashed', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.error) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const detail = error?.message || String(error || 'Неизвестная ошибка');

    return (
      <main className="nx-route-error">
        <section className="nx-route-error__card">
          <div className="nx-route-error__icon" aria-hidden>
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="nx-kicker">Nexus recovery</p>
            <h1>Этот раздел не загрузился</h1>
            <p>
              Остальной Nexus продолжает работать. Можно повторить загрузку страницы или вернуться в чат.
            </p>
          </div>
          <div className="nx-route-error__actions">
            <button type="button" className="nx-btn nx-btn--primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Повторить
            </button>
            <a className="nx-btn nx-btn--secondary" href="/">
              <ArrowLeft size={16} /> В чат
            </a>
          </div>
          {import.meta.env.DEV ? <pre className="nx-route-error__detail">{detail}</pre> : null}
        </section>
      </main>
    );
  }
}
