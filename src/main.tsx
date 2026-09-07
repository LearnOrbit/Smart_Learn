import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "next-themes";
// Side-effect import: must run before any component renders so
// i18next is initialised and `useTranslation()` works on the very
// first paint. The provider itself is exported but unused here —
// the i18next module instance is global.
import "./i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);
