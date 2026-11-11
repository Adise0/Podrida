import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 15px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.onFelt};
    background-color: ${({ theme }) => theme.colors.felt};
    background-image: radial-gradient(
      ellipse at 50% 0%,
      rgba(255, 255, 255, 0.07) 0%,
      transparent 60%
    );
    background-attachment: fixed;
    -webkit-font-smoothing: antialiased;
  }

  /* The wool felt texture, over the color above and under everything else (z-index -1 still paints
     above the page's own background). Fixed, so it doesn't scroll or repeat on long pages. */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    background: url("/img/wool_texture.webp") center / cover no-repeat;
    opacity: 0.1;
    pointer-events: none;
  }

  h1, h2, h3 {
    margin: 0;
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
  }

  a {
    color: inherit;
  }

  button, input, select, textarea {
    font: inherit;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
