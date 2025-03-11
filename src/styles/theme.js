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