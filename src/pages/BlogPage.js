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
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const BlogIntro = styled.div`
    text-align: center;
    max-width: 700px;
    margin: 0 auto ${({ theme }) => theme.spacing.xlarge};

    p {
        font-size: 1.1rem;
        line-height: 1.7;
    }
`;

const BlogGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.xlarge};
    margin-top: ${({ theme }) => theme.spacing.xlarge};
`;

const BlogCard = styled.article`
    background-color: ${({ theme }) => theme.colors.light};
    border-radius: ${({ theme }) => theme.borderRadius};
    overflow: hidden;
    box-shadow: ${({ theme }) => theme.shadows.medium};
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        transform: translateY(-5px);
        box-shadow: ${({ theme }) => theme.shadows.large};
    }
`;

const BlogImageContainer = styled.div`
    height: 240px;
    background-color: ${({ theme }) => theme.colors.accent};
    background-image: ${({ image }) => image ? `url(${image})` : 'none'};
    background-size: cover;
    background-position: center;
    position: relative;
`;

const BlogContent = styled.div`
    padding: ${({ theme }) => theme.spacing.large};
`;

const BlogTitle = styled.h2`
    font-size: 1.8rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};

    a {
        color: ${({ theme }) => theme.colors.primary};
        text-decoration: none;

        &:hover {
            color: ${({ theme }) => theme.colors.secondary};
        }
    }
`;

const BlogMeta = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.8;
`;

const TagsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.small};
    margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const Tag = styled.span`
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.secondary};
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 0.8rem;
    font-weight: 500;
`;

const BlogExcerpt = styled.p`
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    line-height: 1.6;
`;

const ReadMoreLink = styled(Link)`
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 0.95rem;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.secondary};
    text-decoration: none;
    display: inline-flex;
    align-items: center;

    &:after {
        content: "→";
        margin-left: ${({ theme }) => theme.spacing.small};
        transition: transform 0.2s ease;
    }

    &:hover {
        color: ${({ theme }) => theme.colors.primary};

        &:after {
            transform: translateX(4px);
        }
    }
`;

function BlogPage() {
    return (
        <PageContainer>
            <PageTitle>Blog</PageTitle>

            <BlogIntro>
                <p>
                    Welcome to my blog where I share insights, projects, and thoughts on data science,
                    machine learning, and AI applications. Explore articles on technical implementations,
                    industry trends, and practical tips from my experiences.
                </p>
            </BlogIntro>

            <BlogGrid>
                {blogPosts.map((post) => (
                    <BlogCard key={post.id}>
                        <BlogImageContainer image={post.coverImage || '/images/blog/default.png'} />
                        <BlogContent>
                            <BlogTitle>
                                <Link to={`/blog/${post.id}`}>{post.title}</Link>
                            </BlogTitle>
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

                            <BlogExcerpt>{post.excerpt}</BlogExcerpt>

                            <ReadMoreLink to={`/blog/${post.id}`}>
                                Read Article
                            </ReadMoreLink>
                        </BlogContent>
                    </BlogCard>
                ))}
            </BlogGrid>

            {blogPosts.length === 0 && (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                    <p>No blog posts yet. Check back soon!</p>
                </div>
            )}
        </PageContainer>
    );
}

export default BlogPage;