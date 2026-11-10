import { z } from "zod";
import { ptBR } from "zod/locales";
import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import "./styles/routines.css";
import "./styles/finance.css";
import "./styles/future.css";
import "./styles/refinement.css";
z.config(ptBR());
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main role="alert">
        <h1>Precisamos reabrir seu espaço.</h1>
        <p>
          Não foi possível carregar o aplicativo. Seus registros não foram
          apagados.
        </p>
        <button onClick={() => location.reload()}>Tentar novamente</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);
