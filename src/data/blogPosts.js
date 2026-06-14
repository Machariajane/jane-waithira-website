// src/data/blogPosts.js
//
// HOW TO ADD A NEW BLOG POST:
// 1. Create a new .md file in src/data/blogs/ (e.g., my-new-post.md)
//    - You can preview it directly in your IDE!
// 2. Add an entry to the blogPostsMeta array below
// 3. Import the .md file URL and add the markdown file path
// 4. Posts are auto-sorted newest first by sortDate, just add anywhere!
//

// Import markdown file URLs (CRA imports these as URLs)
import buildingShopSmartUrl from './blogs/building-shopSmart.md';
import mattermostDeploymentUrl from './blogs/mattermost-deployment.md';
import buildingQuotaBillingKubernetesOpenstackUrl from './blogs/building-quota-billing-kubernetes-openstack.md';
import openstackDeploymentUrl from './blogs/openstack-deployment.md';
import goInterfacesVsPythonUrl from './blogs/go-interfaces-vs-python-duck-typing.md';
import agentGarageFieldGuideUrl from './blogs/agent-garage-field-guide.md';
import k8sFieldGuideUrl from './blogs/k8s-field-guide.md';
import k8s1ContainersUnderTheHoodUrl from './blogs/k8s-1-containers-under-the-hood.md';
import k8s2DockerAndDockerfilesUrl from './blogs/k8s-2-docker-and-dockerfiles.md';
import k8s3PodsDeploymentsServicesUrl from './blogs/k8s-3-pods-deployments-services.md';
import k8s4StorageConfigmapsIngressUrl from './blogs/k8s-4-storage-configmaps-ingress.md';
import k8s5StatefulsetsRbacNetworkpoliciesUrl from './blogs/k8s-5-statefulsets-rbac-networkpolicies.md';
import k8s6HelmAndFortuneCookiesUrl from './blogs/k8s-6-helm-and-fortune-cookies.md';

// Blog post metadata - ADD NEW POSTS HERE
const blogPostsMeta = [
    {
        id: "k8s-field-guide",
        title: "5 Days from Linux Primitives to Helm Charts: A Kubernetes Field Guide",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "A 7-part deep-dive on everything I learned in the CKAD-track Docker & Kubernetes Fundamentals training at SAP, from chroot, namespaces and cgroups, through Pods, Deployments, Services, Storage, Ingress, StatefulSets, RBAC and NetworkPolicies, to a Helm-deployed Java + Postgres capstone.",
        coverImage: "/images/blog/k8s/K8S_HL_Overview.png",
        tags: ["Kubernetes", "Docker", "Helm", "Linux", "CKAD", "DevOps"],
        contentUrl: k8sFieldGuideUrl,
    },
    {
        id: "k8s-1-containers-under-the-hood",
        title: "Containers Under the Hood: Linux Primitives Before Docker (K8s Field Guide, Part 1)",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "chroot, namespaces, cgroups, capabilities, seccomp, overlayfs, what Docker is actually doing under the hood, and why a container is just a Linux process with the right kernel features stacked around it.",
        coverImage: "/images/blog/k8s/container-stack.jpg",
        tags: ["Kubernetes", "Linux", "Containers", "Docker", "Security"],
        contentUrl: k8s1ContainersUnderTheHoodUrl,
    },
    {
        id: "k8s-2-docker-and-dockerfiles",
        title: "Docker & Dockerfiles: From FROM to Multi-Stage Builds (K8s Field Guide, Part 2)",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "Image lifecycle, multi-stage builds (800MB → 12MB), EXPOSE vs -p, bind-mounts, and the docker buildx fix for Apple Silicon hosts deploying to amd64 clusters.",
        coverImage: "/images/blog/k8s/DockerLifeCycle.png",
        tags: ["Docker", "Containers", "Multi-stage", "Apple Silicon", "buildx"],
        contentUrl: k8s2DockerAndDockerfilesUrl,
    },
    {
        id: "k8s-3-pods-deployments-services",
        title: "Pods, Deployments & Services: The Kubernetes Mental Model (K8s Field Guide, Part 3)",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "kubectl basics, liveness vs readiness vs startup probes, ReplicaSets and rolling updates, label selectors, the three Service types, and the no-Endpoints debugging recipe that solves 80% of routing bugs.",
        coverImage: "/images/blog/k8s/control-plane-architecture.jpg",
        tags: ["Kubernetes", "kubectl", "Deployment", "Service", "Networking"],
        contentUrl: k8s3PodsDeploymentsServicesUrl,
    },
    {
        id: "k8s-4-storage-configmaps-ingress",
        title: "Storage, ConfigMaps & Ingress: Wiring an App Together (K8s Field Guide, Part 4)",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "The Pod → PVC → PV → Storage chain, ReadWriteOnce vs RWOP vs RWX, ConfigMaps and Secrets as env vars vs files, init containers, and Ingress fanout with TLS via cert-manager.",
        coverImage: "/images/blog/k8s/storage-and-services.jpg",
        tags: ["Kubernetes", "Storage", "ConfigMap", "Secret", "Ingress", "TLS"],
        contentUrl: k8s4StorageConfigmapsIngressUrl,
    },
    {
        id: "k8s-5-statefulsets-rbac-networkpolicies",
        title: "StatefulSets, RBAC & Network Policies (K8s Field Guide, Part 5)",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "When a Deployment is wrong: stable hostnames, volumeClaimTemplates, headless services. ServiceAccounts and RBAC. Resource requests, limits, quotas. HPA vs VPA. NetworkPolicy: deny-by-default, and why egress matters more than ingress.",
        coverImage: "/images/blog/k8s/rbac-statefulset-netpol.jpg",
        tags: ["Kubernetes", "StatefulSet", "RBAC", "NetworkPolicy", "Security"],
        contentUrl: k8s5StatefulsetsRbacNetworkpoliciesUrl,
    },
    {
        id: "k8s-6-helm-and-fortune-cookies",
        title: "Helm & The Fortune-Cookies Capstone (K8s Field Guide, Part 6)",
        date: "June 2026",
        sortDate: "2026-06-14",
        author: "Jane Waithira",
        excerpt: "Helm as apt-for-Kubernetes, the chart anatomy, install/upgrade/rollback, the values precedence hierarchy. Then the capstone: a Java + Postgres app, OCI registry, StatefulSet, NetworkPolicies and TLS Ingress, every concept from the series in one running system.",
        coverImage: "/images/blog/k8s/ingress-fanout-virtual-hosts.jpg",
        tags: ["Kubernetes", "Helm", "Postgres", "StatefulSet", "Capstone"],
        contentUrl: k8s6HelmAndFortuneCookiesUrl,
    },
    {
        id: "agent-garage-field-guide",
        title: "Building a Production Multi-Agent System on Google Cloud",
        date: "June 2026",
        sortDate: "2026-06-02",
        author: "Jane Waithira",
        excerpt: "A deep-dive into shipping a multi-agent system with Vertex AI Agent Engine, Cloud Run, ADK, LiteLLM, RAG, SSE streaming, CI/CD, and observability, lessons from real production bugs and code reviews.",
        coverImage: "/images/blog/default.jpg",
        tags: ["AI Agents", "Google Cloud", "RAG", "CI/CD", "Python", "Observability"],
        contentUrl: agentGarageFieldGuideUrl,
    },
    {
        id: "go-interfaces-vs-python-duck-typing",
        title: "Go Interfaces vs Python Duck Typing: A Side-by-Side Comparison",
        date: "April 2026",
        sortDate: "2026-04-15",
        author: "Jane Waithira",
        excerpt: "Coming from Python, Go's type system felt alien. This post maps Go interfaces, receivers, and struct literals to the Python concepts you already know, duck typing, self, and __init__.",
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
        excerpt: "A detailed account of deploying OpenStack on an M-series Mac, troubleshooting nested virtualization, ARM CPU architecture, NAT routing, and mastering cloud infrastructure concepts.",
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
        excerpt: "Lessons learned building quota and billing integration using Kubernetes CRDs, Server-Side Apply, the LIQUID protocol, and Helm, from implementation to production.",
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
