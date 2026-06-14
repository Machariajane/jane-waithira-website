// src/pages/BlogPage.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import blogPosts from '../data/blogPosts';

const PageContainer = styled.div`
    max-width: 900px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xlarge};
`;

const PageTitle = styled.h1`
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const BlogList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.medium};
    margin-top: ${({ theme }) => theme.spacing.large};
`;

// Each post is its own card: white surface against the parchment background,
// thin border + small shadow + accent stripe on the left so items read as
// distinct without going back to the heavy hero-image layout.
const BlogRow = styled(Link)`
    display: block;
    padding: ${({ theme }) => theme.spacing.medium} ${({ theme }) => theme.spacing.large};
    background-color: ${({ theme }) => theme.colors.light};
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-left: 3px solid ${({ theme }) => theme.colors.accent};
    border-radius: ${({ theme }) => theme.borderRadius};
    box-shadow: ${({ theme }) => theme.shadows.small};
    text-decoration: none;
    color: inherit;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-left-color 0.15s ease;

    &:hover {
        transform: translateX(2px);
        box-shadow: ${({ theme }) => theme.shadows.medium};
        border-left-color: ${({ theme }) => theme.colors.secondary};
    }
`;

const RowTitle = styled.h3`
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 1.25rem;
    line-height: 1.3;
    margin: 0 0 4px 0;
    color: ${({ theme }) => theme.colors.primary};

    ${BlogRow}:hover & {
        color: ${({ theme }) => theme.colors.secondary};
    }
`;

const RowMeta = styled.div`
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.7;
    margin-bottom: 6px;
`;

const RowExcerpt = styled.p`
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.85;

    /* Clamp to 2 lines for compactness */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

// Series wrapper is also a card so the hub + nested parts read as one block,
// distinct from neighboring standalone posts.
const SeriesBlock = styled.div`
    background-color: ${({ theme }) => theme.colors.light};
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-left: 3px solid ${({ theme }) => theme.colors.secondary};
    border-radius: ${({ theme }) => theme.borderRadius};
    box-shadow: ${({ theme }) => theme.shadows.small};
    overflow: hidden;
`;

const SeriesParent = styled(Link)`
    display: block;
    padding: ${({ theme }) => theme.spacing.medium} ${({ theme }) => theme.spacing.large} ${({ theme }) => theme.spacing.small};
    text-decoration: none;
    color: inherit;
    transition: background-color 0.15s ease;

    &:hover {
        background-color: ${({ theme }) => theme.colors.background};
    }
`;

const SeriesBadge = styled.span`
    display: inline-block;
    background-color: ${({ theme }) => theme.colors.secondary};
    color: ${({ theme }) => theme.colors.light};
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 3px;
    margin-right: ${({ theme }) => theme.spacing.small};
    vertical-align: middle;
`;

const SeriesParts = styled.ul`
    list-style: none;
    margin: 0;
    padding: ${({ theme }) => theme.spacing.small} ${({ theme }) => theme.spacing.large} ${({ theme }) => theme.spacing.medium};
    border-top: 1px dashed ${({ theme }) => theme.colors.background};
    background-color: ${({ theme }) => theme.colors.background};
`;

const PartRow = styled.li`
    margin: 0;

    a {
        display: flex;
        align-items: baseline;
        gap: ${({ theme }) => theme.spacing.small};
        padding: 6px ${({ theme }) => theme.spacing.small};
        text-decoration: none;
        color: ${({ theme }) => theme.colors.text};
        font-size: 0.95rem;
        line-height: 1.4;
        border-radius: ${({ theme }) => theme.borderRadius};
        transition: background-color 0.15s ease, color 0.15s ease;

        &:hover {
            background-color: ${({ theme }) => theme.colors.light};
            color: ${({ theme }) => theme.colors.secondary};
        }
    }
`;

const PartNumber = styled.span`
    font-family: ${({ theme }) => theme.fonts.code};
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.secondary};
    flex-shrink: 0;
    min-width: 3.5em;
`;

// --- Series grouping ---------------------------------------------------------
// The K8s field guide hub + its 6 parts collapse into a single nested entry.
const K8S_HUB_ID = 'k8s-field-guide';
const K8S_PART_IDS = [
    'k8s-1-containers-under-the-hood',
    'k8s-2-docker-and-dockerfiles',
    'k8s-3-pods-deployments-services',
    'k8s-4-storage-configmaps-ingress',
    'k8s-5-statefulsets-rbac-networkpolicies',
    'k8s-6-helm-and-fortune-cookies',
];

// Strip the "(K8s Field Guide, Part N)" suffix from a part title so the nested
// list reads cleanly.
function shortPartTitle(title) {
    return title.replace(/\s*\(K8s Field Guide,\s*Part\s*\d+\)\s*$/i, '').trim();
}

function partLabel(id) {
    const m = id.match(/^k8s-(\d+)-/);
    return m ? `Part ${m[1]}` : '';
}

function BlogPage() {
    // Build the hub + parts; everything else stays as flat rows in original order.
    const hub = blogPosts.find((p) => p.id === K8S_HUB_ID);
    const parts = K8S_PART_IDS
        .map((id) => blogPosts.find((p) => p.id === id))
        .filter(Boolean);
    const partIdSet = new Set([K8S_HUB_ID, ...K8S_PART_IDS]);
    const otherPosts = blogPosts.filter((p) => !partIdSet.has(p.id));

    return (
        <PageContainer>
            <PageTitle>Blog</PageTitle>

            <BlogList>
                {/* K8s field guide as a series with nested parts */}
                {hub && (
                    <SeriesBlock>
                        <SeriesParent to={`/blog/${hub.id}`}>
                            <RowTitle>
                                <SeriesBadge>Series</SeriesBadge>
                                {hub.title}
                            </RowTitle>
                            <RowMeta>
                                {hub.date} · {parts.length} parts
                            </RowMeta>
                            <RowExcerpt>{hub.excerpt}</RowExcerpt>
                        </SeriesParent>
                        {parts.length > 0 && (
                            <SeriesParts>
                                {parts.map((part) => (
                                    <PartRow key={part.id}>
                                        <Link to={`/blog/${part.id}`}>
                                            <PartNumber>{partLabel(part.id)}</PartNumber>
                                            <span>{shortPartTitle(part.title)}</span>
                                        </Link>
                                    </PartRow>
                                ))}
                            </SeriesParts>
                        )}
                    </SeriesBlock>
                )}

                {/* Everything else as compact rows */}
                {otherPosts.map((post) => (
                    <BlogRow key={post.id} to={`/blog/${post.id}`}>
                        <RowTitle>{post.title}</RowTitle>
                        <RowMeta>
                            {post.date} · {post.author}
                        </RowMeta>
                        <RowExcerpt>{post.excerpt}</RowExcerpt>
                    </BlogRow>
                ))}
            </BlogList>

            {blogPosts.length === 0 && (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                    <p>No blog posts yet. Check back soon!</p>
                </div>
            )}
        </PageContainer>
    );
}

export default BlogPage;
