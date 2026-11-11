import { RouterProvider } from "react-router";
import { ThemeProvider } from "styled-components";
import { router } from "./router/routes";
import { AppStoresProvider } from "./stores/AppStoresProvider";
import { GlobalStyle } from "./styles/GlobalStyle";
import { theme } from "./styles/theme";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AppStoresProvider>
        <RouterProvider router={router} />
      </AppStoresProvider>
    </ThemeProvider>
  );
}

export default App;
