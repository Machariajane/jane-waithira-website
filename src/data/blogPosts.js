// src/data/blogPosts.js
//
// HOW TO ADD A NEW BLOG POST:
// 1. Create a new .md file in src/data/blogs/ (e.g., my-new-post.md)
//    - You can preview it directly in your IDE!
// 2. Add an entry to the blogPostsMeta array below
// 3. Import the .md file URL and add the markdown file path
// 4. Posts are auto-sorted newest first by sortDate — just add anywhere!
//

// Import markdown file URLs (CRA imports these as URLs)
import buildingShopSmartUrl from './blogs/building-shopSmart.md';
import mattermostDeploymentUrl from './blogs/mattermost-deployment.md';
import buildingQuotaBillingKubernetesOpenstackUrl from './blogs/building-quota-billing-kubernetes-openstack.md';
import openstackDeploymentUrl from './blogs/openstack-deployment.md';
import goInterfacesVsPythonUrl from './blogs/go-interfaces-vs-python-duck-typing.md';

// Blog post metadata - ADD NEW POSTS HERE
const blogPostsMeta = [
    {
        id: "go-interfaces-vs-python-duck-typing",
        title: "Go Interfaces vs Python Duck Typing: A Side-by-Side Comparison",
        date: "April 2026",
        sortDate: "2026-04-15",
        author: "Jane Waithira",
        excerpt: "Coming from Python, Go's type system felt alien. This post maps Go interfaces, receivers, and struct literals to the Python concepts you already know — duck typing, self, and __init__.",
        coverImage: "/images/blog/default.jpg",
        tags: ["Go", "Python", "Interfaces", "Type Systems"],
        contentUrl: goInterfacesVsPythonUrl,
    },
    {
        id: "openstack-deployment",
        title: "Setting Up OpenStack DevStack on Apple Silicon: A Complete Learning Experience",
        date: "November 2025",
        sortDate: "2025-11-27",
        author: "Jane Waithira",
        excerpt: "A detailed account of deploying OpenStack on an M-series Mac — troubleshooting nested virtualization, ARM CPU architecture, NAT routing, and mastering cloud infrastructure concepts.",
        coverImage: "/images/blog/default.jpg",
        tags: ["OpenStack", "DevStack", "Apple Silicon", "Virtualization", "Networking"],
        contentUrl: openstackDeploymentUrl,
    },
    {
        id: "building-shopSmart",
        title: "Building shopSmart: A Conversational Shopping Agent with GenAI & LangGraph",
        date: "April 2025",
        sortDate: "2025-04-01",
        author: "Jane Waithira",
        excerpt: "Learn how to combine a modern LLM (Gemini) with a small Python toolkit and LangGraph orchestration to build a multi-step shopping agent.",
        coverImage: "/images/blog/default.jpg",
        tags: ["GenAI", "LangGraph", "Agents", "Python"],
        contentUrl: buildingShopSmartUrl,  // Will be fetched at runtime
    },
    {
        id: "mattermost-deployment",
        title: "Deploying Mattermost on Kubernetes: A Complete Practical Guide",
        date: "February 2026",
        sortDate: "2026-02-01",
        author: "Jane Waithira",
        excerpt: "A comprehensive guide to deploying Mattermost, an open-source messaging platform, on a Kubernetes cluster using Helm charts.",
        coverImage: "/images/blog/default.jpg",
        tags: ["Kubernetes", "Mattermost", "Helm", "DevOps"],
        contentUrl: mattermostDeploymentUrl,
    },
    {
        id: "building-quota-billing-kubernetes-openstack",
        title: "Building Quota Management & Billing Integration on Kubernetes for an OpenStack Service",
        date: "April 2026",
        sortDate: "2026-04-15",
        author: "Jane Waithira",
        excerpt: "Lessons learned building quota and billing integration using Kubernetes CRDs, Server-Side Apply, the LIQUID protocol, and Helm — from implementation to production.",
        coverImage: "/images/blog/default.jpg",
        tags: ["Kubernetes", "OpenStack", "Go", "CRD", "Billing"],
        contentUrl: buildingQuotaBillingKubernetesOpenstackUrl,
    },

    // {
    //     id: "my-new-post",                    // Must match filename: my-new-post.md
    //     title: "My New Blog Post Title",
    //     date: "February 2026",
    //     sortDate: "2026-02-01",               // ISO date for auto-sorting (newest first)
    //     author: "Jane Waithira",
    //     excerpt: "A short description for the blog list page.",
    //     coverImage: "/images/blog/default.jpg",
    //     tags: ["Tag1", "Tag2"],
    //     contentUrl: myNewPostUrl,             // Import URL at top of file
    // },
];

// Sort newest first
blogPostsMeta.sort((a, b) => (b.sortDate || '').localeCompare(a.sortDate || ''));

export default blogPostsMeta;
