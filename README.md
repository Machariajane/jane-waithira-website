# Jane Waithira - Professional Portfolio Website
(This readme was written for the first draft of the website on 23.19 CET 11/03/2025, and it shows the original setup , I will be making continuous changes to the repo ,this is a disclaimer incase I  forget to update the readme )

This repository contains the source code for Jane Waithira's professional portfolio website, built with React and deployed on GitHub Pages. The website showcases Jane's experience as a Data Scientist and ML Engineer through a clean, elegant, and professional design.

## Table of Contents

- [Project Overview](#project-overview)
- [Setup & Installation](#setup--installation)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Deployment Process](#deployment-process)
- [Troubleshooting](#troubleshooting)
- [Customization](#customization)

## Project Overview

This is a professional portfolio website built with React and styled-components. The site features:

- Responsive design that works on all devices
- Clean, professional aesthetic with elegant typography
- Multiple sections showcasing experience, education, skills, and projects
- Contact form for potential employers or collaborators
- GitHub Pages integration for easy deployment

## Setup & Installation

### Prerequisites

- Node.js (v14.x or higher)
- npm (v6.x or higher)
- Git

### Initial Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/jane-waithira-website.git
cd jane-waithira-website
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the development server**

```bash
npm start
```

This will launch the website in development mode at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
jane-waithira-website/
├── public/                # Public assets
│   ├── images/            # Image files
│   │   └── profile.jpg    # Profile picture
│   ├── favicon.ico
│   └── index.html
├── src/
│   ├── components/        # Reusable components
│   │   ├── Header.js      # Navigation header
│   │   ├── Footer.js      # Page footer
│   │   └── Divider.js     # Decorative divider component
│   ├── pages/             # Page components
│   │   ├── HomePage.js    # Landing page with intro
│   │   ├── ExperiencePage.js  # Professional experience timeline
│   │   ├── EducationPage.js   # Education and certifications
│   │   ├── SkillsPage.js      # Skills and expertise
│   │   ├── ProjectsPage.js    # Projects and awards
│   │   └── ContactPage.js     # Contact form and details
│   ├── styles/            # Styling
│   │   ├── GlobalStyle.js # Global styles
│   │   └── theme.js       # Theme configuration
│   └── App.js             # Main app component with routing
├── package.json
├── README.md
└── .gitignore
```

## Development Workflow

### Local Development

1. Make changes to your code
2. Test locally with `npm start`
3. View your changes at http://localhost:3000

### Styling

- The website uses styled-components for CSS-in-JS styling
- The theme configuration is in `src/styles/theme.js`
- Global styles are defined in `src/styles/GlobalStyle.js`

### Adding Content

- To update your personal information, edit the relevant page components
- To add a new project, update the `projects` array in `src/pages/ProjectsPage.js`
- To add a new skill, update the `skills` array in `src/pages/SkillsPage.js`
- To update your experience, modify the `experiences` array in `src/pages/ExperiencePage.js`

### Adding Images

1. Place image files in the `public/images/` directory
2. Reference them in your components using the path `/images/filename.jpg`

## Deployment Process

This website is configured for deployment to GitHub Pages using the `gh-pages` package.

### Initial GitHub Pages Setup

1. **Install gh-pages package (already included in package.json)**

```bash
npm install --save-dev gh-pages
```

2. **Add homepage to package.json**

Your package.json should include:

```json
{
   "homepage": "https://yourusername.github.io/jane-waithira-website",
   "scripts": {
      "predeploy": "npm run build",
      "deploy": "gh-pages -d build"
   }
}
```

Replace `yourusername` with your actual GitHub username.

3. **Create and configure the GitHub repository**

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/jane-waithira-website.git
git push -u origin main
```

### Deploying Updates

When you're ready to deploy changes:

1. **Commit your changes to the main branch**

```bash
git add .
git commit -m "Description of changes"
git push origin main
```

2. **Deploy to GitHub Pages**

```bash
npm run deploy
```

This will:
- Build the project (`npm run build`)
- Push the built files to the `gh-pages` branch
- GitHub Pages will then update your live site

### How GitHub Pages Works with This Project

- The `main` branch contains your source code
- The `gh-pages` branch contains the built version of your site
- The `npm run deploy` command handles building and updating the `gh-pages` branch
- GitHub Pages serves the content from the `gh-pages` branch

## Troubleshooting

### Page Not Found Errors

If you encounter 404 errors when navigating directly to a route:

- Check that HashRouter is working correctly in `App.js`
- Ensure all routes are properly defined

### Images Not Loading

If images are not appearing:

- Make sure paths are correct (should start with `/images/`)
- Check that image files exist in the `public/images/` directory
- Verify file names and extensions are correct (case-sensitive)

### Deployment Issues

If deployment fails:

- Ensure you have proper permissions for the repository
- Verify your GitHub token has the necessary permissions
- Try running with verbose logging:

```bash
npm run deploy -- -d
```

## Customization

### Changing Colors and Theme

To update the visual theme:

1. Open `src/styles/theme.js`
2. Modify the colors, fonts, and other style variables

### Adding New Pages

To add a new page:

1. Create a new component in the `src/pages/` directory
2. Add a new route in `src/App.js`
3. Add a link to the new page in the `Header.js` component

### Customizing the Contact Form

The contact form is functional but doesn't submit data anywhere. To connect it:

1. Open `src/pages/ContactPage.js`
2. Modify the `handleSubmit` function to send data to your preferred service
   (e.g., Formspree, Netlify Forms, or a custom backend)
3. I'll implement the email functionality using EmailJS, which is one of the simplest solutions for React applications. It allows you to send emails directly from the client-side without setting up a backend server.