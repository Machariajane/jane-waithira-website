// src/data/blogPosts.js
//
// HOW TO ADD A NEW BLOG POST:
// 1. Create a new .md file in src/data/blogs/ (e.g., my-new-post.md)
//    - You can preview it directly in your IDE!
// 2. Add an entry to the blogPostsMeta array below
// 3. Import the .md file URL and add the markdown file path
//

// Import markdown file URLs (CRA imports these as URLs)
import buildingShopSmartUrl from './blogs/building-shopSmart.md';
import mattermostDeploymentUrl from './blogs/mattermost-deployment.md';

// Blog post metadata - ADD NEW POSTS HERE
const blogPostsMeta = [
    {
        id: "building-shopSmart",
        title: "Building shopSmart: A Conversational Shopping Agent with GenAI & LangGraph",
        date: "April 2025",
        author: "Jane Waithira",
        excerpt: "Learn how to combine a modern LLM (Gemini) with a small Python toolkit and LangGraph orchestration to build a multi-step shopping agent.",
        coverImage: "/images/blog/default.jpg",
        tags: ["GenAI", "LangGraph", "Agents", "Python"],
        contentUrl: buildingShopSmartUrl,  // Will be fetched at runtime
    },
    {
        id: "mattermost-deployment",
        title: "Deploying Mattermost on Kubernetes: A Step-by-Step Guide",
        date: "February 2026",
        author: "Jane Waithira",
        excerpt: "A comprehensive guide to deploying Mattermost, an open-source messaging platform, on a Kubernetes cluster using Helm charts.",
        coverImage: "/images/blog/default.jpg",
        tags: ["Kubernetes", "Mattermost", "Helm", "DevOps"],
        contentUrl: mattermostDeploymentUrl,
    },

    // {
    //     id: "my-new-post",                    // Must match filename: my-new-post.md
    //     title: "My New Blog Post Title",
    //     date: "February 2026",
    //     author: "Jane Waithira",
    //     excerpt: "A short description for the blog list page.",
    //     coverImage: "/images/blog/default.jpg",
    //     tags: ["Tag1", "Tag2"],
    //     contentUrl: myNewPostUrl,             // Import URL at top of file
    // },
];

export default blogPostsMeta;
