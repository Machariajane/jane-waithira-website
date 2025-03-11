// src/styles/theme.js
const theme = {
    colors: {
        primary: '#8B0000', // Deep Roman red
        secondary: '#DAA520', // Gold accent
        background: '#F5F5DC', // Parchment-like background
        text: '#2F4F4F', // Dark slate text
        accent: '#483D8B', // Dark slate blue
        light: '#F8F8FF', // Light background
        dark: '#191970', // Midnight blue
    },
    fonts: {
        heading: '"Cinzel", serif', // Roman-inspired serif font
        body: '"Raleway", sans-serif', // Clean sans-serif for body text
        code: '"Fira Code", monospace', // Monospace for code sections
    },
    shadows: {
        small: '0 2px 4px rgba(0, 0, 0, 0.1)',
        medium: '0 4px 8px rgba(0, 0, 0, 0.12)',
        large: '0 8px 16px rgba(0, 0, 0, 0.14)',
    },
    borderRadius: '4px',
    maxWidth: '1200px',
    spacing: {
        small: '8px',
        medium: '16px',
        large: '24px',
        xlarge: '32px',
    },
};

export default theme;

// src/styles/GlobalStyle.js
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Raleway:wght@300;400;600&family=Fira+Code&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: ${({ theme }) => theme.fonts.body};
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.fonts.heading};
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    color: ${({ theme }) => theme.colors.primary};
    letter-spacing: 1px;
  }

  h1 {
    font-size: 2.5rem;
    margin-top: ${({ theme }) => theme.spacing.xlarge};
    position: relative;
    
    &:after {
      content: "";
      display: block;
      width: 80px;
      height: 4px;
      background-color: ${({ theme }) => theme.colors.secondary};
      margin-top: ${({ theme }) => theme.spacing.small};
    }
  }

  h2 {
    font-size: 2rem;
  }

  p {
    margin-bottom: ${({ theme }) => theme.spacing.medium};
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-decoration: none;
    transition: color 0.2s ease;
    
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  }

  code {
    font-family: ${({ theme }) => theme.fonts.code};
    background-color: ${({ theme }) => theme.colors.light};
    padding: 2px 4px;
    border-radius: ${({ theme }) => theme.borderRadius};
    font-size: 0.9em;
  }

  pre {
    background-color: ${({ theme }) => theme.colors.dark};
    color: ${({ theme }) => theme.colors.light};
    padding: ${({ theme }) => theme.spacing.medium};
    border-radius: ${({ theme }) => theme.borderRadius};
    overflow-x: auto;
    margin-bottom: ${({ theme }) => theme.spacing.large};
    
    code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
  }

  blockquote {
    border-left: 4px solid ${({ theme }) => theme.colors.secondary};
    padding-left: ${({ theme }) => theme.spacing.medium};
    margin-left: 0;
    margin-right: 0;
    font-style: italic;
    color: ${({ theme }) => theme.colors.primary};
  }

  img {
    max-width: 100%;
    height: auto;
  }

  .container {
    width: 100%;
    max-width: ${({ theme }) => theme.maxWidth};
    margin: 0 auto;
    padding: 0 ${({ theme }) => theme.spacing.medium};
  }

  .roman-separator {
    display: flex;
    align-items: center;
    margin: ${({ theme }) => theme.spacing.large} 0;
    
    &:before, &:after {
      content: "";
      flex-grow: 1;
      height: 1px;
      background-color: ${({ theme }) => theme.colors.secondary};
      opacity: 0.5;
    }
    
    span {
      padding: 0 ${({ theme }) => theme.spacing.medium};
      font-family: ${({ theme }) => theme.fonts.heading};
      color: ${({ theme }) => theme.colors.secondary};
      font-size: 1.5rem;
    }
  }

  .scroll-decoration {
    position: relative;
    
    &:before, &:after {
      content: "⚜";
      font-size: 1.2rem;
      color: ${({ theme }) => theme.colors.secondary};
      opacity: 0.7;
      position: absolute;
      transform: translateX(-50%);
    }
    
    &:before {
      top: -20px;
      left: 50%;
    }
    
    &:after {
      bottom: -20px;
      left: 50%;
    }
  }
`;

export default GlobalStyle;