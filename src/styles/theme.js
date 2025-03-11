// src/styles/theme.js
const theme = {
    colors: {
        primary: '#4A4A4A',       // Dark gray for primary text
        secondary: '#8B5A2B',     // Warm brown for accents
        background: '#F5F5F0',    // Off-white parchment-like background
        text: '#333333',          // Near-black for text
        accent: '#4B6587',        // Muted blue-gray
        light: '#FFFFFF',         // White
        dark: '#1E1E1E',          // Almost black
        highlight: '#A57C52'      // Lighter brown highlight
    },
    fonts: {
        heading: '"Cormorant Garamond", serif', // Elegant serif for headings
        body: '"Raleway", sans-serif',          // Clean sans-serif for body
        code: '"Fira Code", monospace',         // Monospace for code sections
    },
    shadows: {
        small: '0 2px 4px rgba(0, 0, 0, 0.05)',
        medium: '0 4px 8px rgba(0, 0, 0, 0.08)',
        large: '0 8px 16px rgba(0, 0, 0, 0.1)',
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