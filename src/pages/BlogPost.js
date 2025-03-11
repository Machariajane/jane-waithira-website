// src/pages/BlogPost.js
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import articles from '../data/articles';

const ArticleContainer = styled.article`
  max-width: 800px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xlarge};
`;

const ArticleHeader = styled.header`
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
  text-align: center;
`;

const ArticleTitle = styled.h1`
  font-size: 2.8rem;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  position: relative;
  
  &:after {
    content: "";
    display: block;
    width: 80px;
    height: 4px;
    background-color: ${({ theme }) => theme.colors.secondary};
    margin: ${({ theme }) => theme.spacing.small} auto 0;
  }
`;

const ArticleMeta = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.large};
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text};
  opacity: 0.8;
  
  span {
    margin: 0 ${({ theme }) => theme.spacing.medium};
    
    &:not(:last-child):after {
      content: "•";
      margin-left: ${({ theme }) => theme.spacing.medium};
    }
  }
`;

const ArticleImage = styled.div`
  height: 400px;
  background-color: ${({ theme }) => theme.colors.accent};
  background-image: ${({ image }) => image ? `url(${image})` : 'none'};
  background-size: cover;
  background-position: center;
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.medium};
`;

const ArticleContent = styled.div`
  line-height: 1.8;
  
  p {
    margin-bottom: ${({ theme }) => theme.spacing.large};
  }
  
  h2 {
    margin-top: ${({ theme }) => theme.spacing.xlarge};
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    font-size: 1.8rem;
  }
  
  h3 {
    margin-top: ${({ theme }) => theme.spacing.large};
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    font-size: 1.5rem;
  }
  
  ul, ol {
    margin-bottom: ${({ theme }) => theme.spacing.large};
    padding-left: ${({ theme }) => theme.spacing.xlarge};
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
    }
  }
  
  blockquote {
    margin: ${({ theme }) => theme.spacing.large} 0;
    padding: ${({ theme }) => theme.spacing.large};
    border-left: 4px solid ${({ theme }) => theme.colors.secondary};
    background-color: rgba(0, 0, 0, 0.03);
    font-style: italic;
    
    p:last-child {
      margin-bottom: 0;
    }
  }
  
  pre {
    margin-bottom: ${({ theme }) => theme.spacing.large};
    padding: ${({ theme }) => theme.spacing.large};
    background-color: ${({ theme }) => theme.colors.dark};
    border-radius: ${({ theme }) => theme.borderRadius};
    overflow-x: auto;
    
    code {
      background-color: transparent;
      padding: 0;
    }
  }
  
  code {
    font-family: ${({ theme }) => theme.fonts.code};
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 5px;
    border-radius: 3px;
  }
`;

const RomanDivider = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.spacing.xlarge} 0;
  
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
`;

const AuthorSection = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.large};
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius};
  margin-top: ${({ theme }) => theme.spacing.xlarge};
`;

const AuthorImage = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.primary};
  background-image: url('/images/author.jpg');
  background-size: cover;
  margin-right: ${({ theme }) => theme.spacing.large};
  flex-shrink: 0;
`;

const AuthorInfo = styled.div`
  h4 {
    font-size: 1.2rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
  }
  
  p {
    font-size: 0.9rem;
    margin-bottom: 0;
  }
`;

const RelatedPosts = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xlarge};

  h3 {
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.large};
  }
`;

const RelatedPostsList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.large};
`;

const RelatedPostItem = styled.div`
  background-color: ${({ theme }) => theme.colors.light};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.small};
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
`;

const RelatedPostImage = styled.div`
  height: 150px;
  background-color: ${({ theme }) => theme.colors.accent};
  background-image: ${({ image }) => image ? `url(${image})` : 'none'};
  background-size: cover;
  background-position: center;
`;

const RelatedPostContent = styled.div`
  padding: ${({ theme }) => theme.spacing.medium};

  h4 {
    font-size: 1.1rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
    
    a {
      color: ${({ theme }) => theme.colors.primary};
      text-decoration: none;
      
      &:hover {
        color: ${({ theme }) => theme.colors.accent};
      }
    }
  }
  
  p {
    font-size: 0.9rem;
    margin-bottom: 0;
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.8;
  }
`;

function BlogPost() {
    const { id } = useParams();
    // This would normally fetch the article from an API
    const article = articles.find(a => a.id === parseInt(id)) || {
        id: 1,
        title: "The Art of Code Refactoring: Roman Engineering Principles",
        date: "March 5, 2025",
        author: "Marcus Aurelius",
        category: "Code Quality",
        readTime: "8 min read",
        image: "/images/placeholder1.jpg",
        content: `
      <p>The ancient Romans were known for their exceptional engineering feats. The aqueducts, roads, and architectural marvels they built have stood the test of time, some still functioning nearly two millennia later. What can modern software developers learn from these ancient engineers? As it turns out, quite a lot.</p>
      
      <h2>Principles of Roman Engineering</h2>
      
      <p>Roman engineers adhered to three key principles: <strong>durability</strong>, <strong>utility</strong>, and <strong>beauty</strong> (or <em>firmitas</em>, <em>utilitas</em>, and <em>venustas</em> in Latin). These principles, first outlined by Vitruvius in his work "De Architectura," can be directly applied to code refactoring.</p>
      
      <blockquote>
        <p>"Programming is an art form that fights back." - Anonymous</p>
      </blockquote>
      
      <h3>Durability (Firmitas)</h3>
      
      <p>Roman structures were built to last. They used innovative materials like concrete and developed techniques like arches to distribute weight effectively. In code, durability translates to robustness and maintainability. Here's how to achieve it:</p>
      
      <ul>
        <li>Write comprehensive tests to ensure your code works as expected and continues to work after changes</li>
        <li>Follow the SOLID principles to create modular, maintainable code</li>
        <li>Use defensive programming techniques to handle unexpected inputs and edge cases</li>
        <li>Document your code thoroughly to help future developers understand its purpose and function</li>
      </ul>
      
      <h3>Utility (Utilitas)</h3>
      
      <p>Roman engineering always served a practical purpose. Their roads connected the empire, aqueducts supplied water, and public baths promoted hygiene. Similarly, your code should:</p>
      
      <ul>
        <li>Solve a real problem efficiently</li>
        <li>Be easily reusable across different parts of your application</li>
        <li>Perform well under its expected load</li>
        <li>Be adaptable to changing requirements</li>
      </ul>
      
      <h3>Beauty (Venustas)</h3>
      
      <p>Romans didn't just build functional structures; they created beautiful ones. In code, beauty means elegance and simplicity:</p>
      
      <pre><code>// Complex and hard to understand
for(int i=0;i<a.length;i++){if(a[i]>max){max=a[i];}else if(a[i]<min){min=a[i];}}</code></pre>
      
      <p>Compared to:</p>
      
      <pre><code>// Clear, elegant, and maintainable
for (int i = 0; i < array.length; i++) {
  if (array[i] > maximum) {
    maximum = array[i];
  } else if (array[i] < minimum) {
    minimum = array[i];
  }
}</code></pre>
      
      <h2>Implementing Roman Principles in Code Refactoring</h2>
      
      <p>When refactoring code, consider how you can apply these Roman engineering principles:</p>
      
      <ol>
        <li><strong>Plan before building</strong>: Romans created detailed plans before construction. Similarly, understand the codebase fully before refactoring.</li>
        <li><strong>Use proven patterns</strong>: Romans reused successful architectural patterns across their empire. In software, design patterns are our time-tested solutions.</li>
        <li><strong>Build incrementally</strong>: Major Roman projects were built in phases. Refactor your code in small, testable increments.</li>
        <li><strong>Focus on fundamentals</strong>: Romans excelled at foundations and infrastructure. Prioritize improving core systems that everything else depends on.</li>
      </ol>
      
      <p>By applying these ancient principles to modern code refactoring, you can create software that, like Roman architecture, stands the test of time—functional, maintainable, and elegant.</p>
    `,
        relatedPosts: [2, 3]
    };

    // Get related posts
    const relatedPosts = article.relatedPosts?.map(id => articles.find(a => a.id === id)) || [];

    return (
        <ArticleContainer>
            <ArticleHeader>
                <ArticleTitle>{article.title}</ArticleTitle>
                <ArticleMeta>
                    <span>{article.date}</span>
                    <span>{article.author}</span>
                    <span>{article.category}</span>
                    <span>{article.readTime}</span>
                </ArticleMeta>
            </ArticleHeader>

            <ArticleImage image={article.image} />

            <ArticleContent dangerouslySetInnerHTML={{ __html: article.content }} />

            <RomanDivider>
                <span>⚔️</span>
            </RomanDivider>

            <AuthorSection>
                <AuthorImage />
                <AuthorInfo>
                    <h4>{article.author}</h4>
                    <p>Developer, writer, and enthusiast of Roman history. Passionate about bringing ancient wisdom to modern technology.</p>
                </AuthorInfo>
            </AuthorSection>

            {relatedPosts.length > 0 && (
                <RelatedPosts>
                    <h3>Related Articles</h3>
                    <RelatedPostsList>
                        {relatedPosts.map(post => (
                            <RelatedPostItem key={post.id}>
                                <RelatedPostImage image={post.image} />
                                <RelatedPostContent>
                                    <h4>
                                        <Link to={`/post/${post.id}`}>{post.title}</Link>
                                    </h4>
                                    <p>{post.date} • {post.readTime}</p>
                                </RelatedPostContent>
                            </RelatedPostItem>
                        ))}
                    </RelatedPostsList>
                </RelatedPosts>
            )}
        </ArticleContainer>
    );
}

export default BlogPost;