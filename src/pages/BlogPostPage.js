// src/pages/BlogPostPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import RomanDivider from '../components/RomanDivider';
import blogPosts from '../data/blogPosts';
import ReactMarkdown from 'react-markdown';

const PageContainer = styled.div`
    max-width: 800px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xlarge};
`;

const BackButton = styled(Link)`
    display: inline-flex;
    align-items: center;
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.primary};
    margin-bottom: ${({ theme }) => theme.spacing.large};
    text-decoration: none;

    &:before {
        content: "←";
        margin-right: ${({ theme }) => theme.spacing.small};
        transition: transform 0.2s ease;
    }

    &:hover {
        color: ${({ theme }) => theme.colors.secondary};

        &:before {
            transform: translateX(-4px);
        }
    }
`;

const BlogHeader = styled.header`
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const BlogTitle = styled.h1`
    font-size: 2.5rem;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const BlogMeta = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.spacing.large};
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.8;
`;

const TagsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.small};
    margin-bottom: ${({ theme }) => theme.spacing.large};
`;

const Tag = styled.span`
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.secondary};
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 0.9rem;
    font-weight: 500;
`;

const FeaturedImage = styled.div`
    width: 100%;
    height: 400px;
    background-color: ${({ theme }) => theme.colors.accent};
    background-image: ${({ image }) => image ? `url(${image})` : 'none'};
    background-size: cover;
    background-position: center;
    border-radius: ${({ theme }) => theme.borderRadius};
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const BlogContent = styled.article`
    line-height: 1.8;

    h1, h2, h3, h4, h5, h6 {
        margin-top: ${({ theme }) => theme.spacing.xlarge};
        margin-bottom: ${({ theme }) => theme.spacing.medium};
        color: ${({ theme }) => theme.colors.primary};
    }

    h1 {
        font-size: 2.2rem;
    }

    h2 {
        font-size: 1.8rem;
    }

    h3 {
        font-size: 1.5rem;
    }

    p {
        margin-bottom: ${({ theme }) => theme.spacing.large};
    }

    ul, ol {
        margin-bottom: ${({ theme }) => theme.spacing.large};
        padding-left: ${({ theme }) => theme.spacing.xlarge};

        li {
            margin-bottom: ${({ theme }) => theme.spacing.small};
        }
    }

    a {
        color: ${({ theme }) => theme.colors.secondary};
        text-decoration: none;

        &:hover {
            text-decoration: underline;
        }
    }

    blockquote {
        border-left: 4px solid ${({ theme }) => theme.colors.secondary};
        padding-left: ${({ theme }) => theme.spacing.medium};
        margin-left: 0;
        margin-right: 0;
        margin-bottom: ${({ theme }) => theme.spacing.large};
        font-style: italic;
        color: ${({ theme }) => theme.colors.accent};
    }

    img {
        max-width: 100%;
        height: auto;
        margin: ${({ theme }) => theme.spacing.large} 0;
        border-radius: ${({ theme }) => theme.borderRadius};
    }

    code {
        font-family: ${({ theme }) => theme.fonts.code};
        background-color: rgba(0, 0, 0, 0.05);
        padding: 2px 4px;
        border-radius: 3px;
    }

    pre {
        background-color: ${({ theme }) => theme.colors.dark};
        color: ${({ theme }) => theme.colors.light};
        padding: ${({ theme }) => theme.spacing.large};
        border-radius: ${({ theme }) => theme.borderRadius};
        overflow-x: auto;
        margin-bottom: ${({ theme }) => theme.spacing.large};

        code {
            background-color: transparent;
            padding: 0;
            color: inherit;
        }
    }

    hr {
        border: none;
        height: 1px;
        background-color: rgba(0, 0, 0, 0.1);
        margin: ${({ theme }) => theme.spacing.xlarge} 0;
    }
`;

const NotFoundContainer = styled.div`
    text-align: center;
    margin: ${({ theme }) => theme.spacing.xlarge} 0;

    h2 {
        margin-bottom: ${({ theme }) => theme.spacing.large};
    }

    p {
        margin-bottom: ${({ theme }) => theme.spacing.large};
    }
`;

const LoadingContainer = styled.div`
    text-align: center;
    padding: ${({ theme }) => theme.spacing.xlarge};
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.7;
`;

function BlogPostPage() {
    const { id } = useParams();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    const post = blogPosts.find(post => post.id === id);

    // Fetch markdown content from URL
    useEffect(() => {
        if (post?.contentUrl) {
            setLoading(true);
            fetch(post.contentUrl)
                .then(response => response.text())
                .then(text => {
                    setContent(text);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error loading blog content:', err);
                    setContent('Error loading content.');
                    setLoading(false);
                });
        } else if (post?.content) {
            // Fallback for inline content (if any)
            setContent(post.content);
            setLoading(false);
        } else {
            setLoading(false);
        }
    }, [post]);

    if (!post) {
        return (
            <PageContainer>
                <BackButton to="/blog">Back to all posts</BackButton>

                <NotFoundContainer>
                    <h2>Blog Post Not Found</h2>
                    <p>The blog post you're looking for doesn't exist or may have been removed.</p>
                    <Link to="/blog">
                        <button>View All Blog Posts</button>
                    </Link>
                </NotFoundContainer>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <BackButton to="/blog">Back to all posts</BackButton>

            <BlogHeader>
                <BlogTitle>{post.title}</BlogTitle>
                <BlogMeta>
                    <span>{post.date}</span>
                    <span style={{ margin: '0 8px' }}>•</span>
                    <span>By {post.author}</span>
                </BlogMeta>

                <TagsContainer>
                    {post.tags.map((tag, index) => (
                        <Tag key={index}>{tag}</Tag>
                    ))}
                </TagsContainer>

                {post.coverImage && (
                    <FeaturedImage image={post.coverImage} />
                )}
            </BlogHeader>

            {loading ? (
                <LoadingContainer>Loading article...</LoadingContainer>
            ) : (
                <BlogContent>
                    <ReactMarkdown>{content}</ReactMarkdown>
                </BlogContent>
            )}

            <RomanDivider symbol="•" />

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <BackButton to="/blog" style={{ margin: '0 auto' }}>Back to all posts</BackButton>
            </div>
        </PageContainer>
    );
}

export default BlogPostPage;