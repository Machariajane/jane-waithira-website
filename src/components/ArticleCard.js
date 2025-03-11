// src/components/ArticleCard.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const Card = styled.article`
  background-color: ${({ theme }) => theme.colors.light};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.medium};
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: ${({ theme }) => theme.shadows.large};
  }
`;

const CardImage = styled.div`
  height: 200px;
  background-color: ${({ theme }) => theme.colors.accent};
  background-image: ${({ image }) => image ? `url(${image})` : 'none'};
  background-size: cover;
  background-position: center;
  position: relative;
  
  &:after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(to right, 
      ${({ theme }) => theme.colors.primary}, 
      ${({ theme }) => theme.colors.secondary}, 
      ${({ theme }) => theme.colors.primary}
    );
  }
`;

const CardContent = styled.div`
  padding: ${({ theme }) => theme.spacing.large};
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const CardTitle = styled.h3`
  font-size: 1.5rem;
  margin-bottom: ${({ theme }) => theme.spacing.small};
  
  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    
    &:hover {
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text};
  opacity: 0.8;
`;

const CardExcerpt = styled.p`
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  flex-grow: 1;
`;

const CardReadMore = styled(Link)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: ${({ theme }) => theme.colors.accent};
  position: relative;
  align-self: flex-start;
  
  &:after {
    content: "→";
    margin-left: ${({ theme }) => theme.spacing.small};
    transition: transform 0.2s ease;
  }
  
  &:hover:after {
    transform: translateX(4px);
  }
`;

const CategoryTag = styled.span`
  display: inline-block;
  padding: ${({ theme }) => `${theme.spacing.small} ${theme.spacing.medium}`};
  background-color: ${({ theme }) => theme.colors.secondary};
  color: ${({ theme }) => theme.colors.light};
  font-size: 0.8rem;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
  position: absolute;
  top: ${({ theme }) => theme.spacing.medium};
  left: ${({ theme }) => theme.spacing.medium};
`;

function ArticleCard({ article, showCategory = false }) {
    return (
        <Card>
            <CardImage image={article.image}>
                {showCategory && <CategoryTag>{article.category}</CategoryTag>}
            </CardImage>
            <CardContent>
                <CardTitle>
                    <Link to={`/post/${article.id}`}>{article.title}</Link>
                </CardTitle>
                <CardMeta>
                    <span>{article.date}</span>
                    {article.readTime && (
                        <>
                            <span style={{ margin: '0 8px' }}>•</span>
                            <span>{article.readTime}</span>
                        </>
                    )}
                </CardMeta>
                <CardExcerpt>{article.excerpt}</CardExcerpt>
                <CardReadMore to={`/post/${article.id}`}>
                    Continue Reading
                </CardReadMore>
            </CardContent>
        </Card>
    );
}

export default ArticleCard;